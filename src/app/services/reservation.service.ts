import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Product } from '../models/product';
import { ReservationItemDTO } from '../models/checkout-dtos';

/**
 * Internal reservation tracking structure.
 */
interface Reservation {
  reservationId: string;
  createdAtMs: number;
  expiresAtMs: number;
  items: Map<number, { title: string; originalStock: number; requestedQuantity: number }>;
  status: 'active' | 'confirmed' | 'cancelled' | 'expired';
}

/**
 * ReservationService ensures atomic, race-safe stock operations.
 *
 * High-level flow:
 * 1. validateAndReserve() - Check stock availability and create a reservation.
 * 2. confirmReservation() - Persist the stock changes (decrement and commit).
 * 3. cancelReservation() - Roll back the reservation if checkout fails.
 *
 * This prevents race conditions where two customers might buy the last item.
 */
@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly apiUrl = 'http://192.168.1.5:3000/products';
  private readonly reservationTimeoutMs = 5 * 60 * 1000; // 5 minutes
  private activeReservations = new Map<string, Reservation>();

  constructor(private http: HttpClient) {}

  /**
   * Validate stock availability and create a reservation.
   *
   * @param items Cart items to reserve
   * @returns Reservation ID if successful
   * @throws CheckoutError if stock is insufficient or product not found
   */
  async validateAndReserve(
    items: { productId: number; title: string; quantity: number }[]
  ): Promise<string> {
    const reservationId = this.generateReservationId();
    const reservation: Reservation = {
      reservationId,
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + this.reservationTimeoutMs,
      items: new Map(),
      status: 'active',
    };

    try {
      // Fetch current stock for all items in parallel
      const productFetches = items.map((item) =>
        this.fetchProductStock(item.productId).catch((error) => {
          throw this.throwProductNotFound(item.productId, item.title);
        })
      );

      const products = await Promise.all(productFetches);

      // Validate availability
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const product = products[i];
        const availableStock = this.getAvailableStock(product);

        if (!product.inStock || availableStock < item.quantity) {
          throw this.throwInsufficientStock(
            item.productId,
            item.title,
            item.quantity,
            availableStock
          );
        }

        // Record the reservation
        reservation.items.set(item.productId, {
          title: item.title,
          originalStock: availableStock,
          requestedQuantity: item.quantity,
        });
      }

      // Store the reservation
      this.activeReservations.set(reservationId, reservation);
      return reservationId;
    } catch (error) {
      // Clean up on failure
      this.activeReservations.delete(reservationId);
      throw error;
    }
  }

  /**
   * Confirm the reservation by persisting stock changes.
   *
   * @param reservationId The reservation to confirm
   * @throws CheckoutError if reservation is invalid or expired
   */
  async confirmReservation(reservationId: string): Promise<void> {
    const reservation = this.activeReservations.get(reservationId);

    if (!reservation) {
      throw this.throwReservationNotFound(reservationId);
    }

    if (reservation.status !== 'active') {
      throw this.throwReservationInvalid(reservationId, reservation.status);
    }

    if (Date.now() > reservation.expiresAtMs) {
      reservation.status = 'expired';
      throw this.throwReservationExpired(reservationId);
    }

    try {
      // Update stock for all reserved items in parallel
      const updatePromises = Array.from(reservation.items.entries()).map(
        ([productId, reserved]) => this.decrementProductStock(productId, reserved)
      );

      await Promise.all(updatePromises);

      // Mark as confirmed
      reservation.status = 'confirmed';
    } catch (error) {
      // Leave reservation active so it can be retried or cancelled
      throw error;
    }
  }

  /**
   * Cancel a reservation, freeing up the reserved items.
   *
   * @param reservationId The reservation to cancel
   */
  cancelReservation(reservationId: string): void {
    const reservation = this.activeReservations.get(reservationId);
    if (reservation && reservation.status === 'active') {
      reservation.status = 'cancelled';
    }
    // Clean up after a delay to avoid accidental reuse
    setTimeout(
      () => this.activeReservations.delete(reservationId),
      1000
    );
  }

  /**
   * Get reservation details (for debugging/testing).
   */
  getReservation(reservationId: string): Reservation | undefined {
    return this.activeReservations.get(reservationId);
  }

  // ========== Private Helpers ==========

  private async fetchProductStock(productId: number): Promise<Product> {
    const response = await firstValueFrom(
      this.http.get<Product>(`${this.apiUrl}/${productId}`)
    );
    return response;
  }

  private async decrementProductStock(
    productId: number,
    reserved: { title: string; requestedQuantity: number }
  ): Promise<void> {
    const product = await this.fetchProductStock(productId);
    const availableStock = this.getAvailableStock(product);

    // Double-check stock hasn't changed since reservation
    if (availableStock < reserved.requestedQuantity) {
      throw this.throwStockChanged(
        productId,
        reserved.title,
        reserved.requestedQuantity,
        availableStock
      );
    }

    const nextStock = availableStock - reserved.requestedQuantity;
    const updated: Product = {
      ...product,
      stockCount: nextStock,
      inStock: nextStock > 0,
    };

    await firstValueFrom(this.http.put(`${this.apiUrl}/${productId}`, updated));
  }

  private getAvailableStock(product: Product): number {
    return product.stockCount ?? 5;
  }

  private generateReservationId(): string {
    return `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========== Error Factories ==========

  private throwProductNotFound(productId: number, title: string): never {
    const error = new Error(`Product not found: ${title} (ID: ${productId})`);
    (error as any).reason = 'PRODUCT_NOT_FOUND';
    (error as any).productId = productId;
    throw error;
  }

  private throwInsufficientStock(
    productId: number,
    title: string,
    requested: number,
    available: number
  ): never {
    const error = new Error(
      `Insufficient stock for "${title}". Requested ${requested}, available ${available}.`
    );
    (error as any).reason = 'INSUFFICIENT_STOCK';
    (error as any).productId = productId;
    (error as any).requestedQuantity = requested;
    (error as any).availableQuantity = available;
    throw error;
  }

  private throwStockChanged(
    productId: number,
    title: string,
    requested: number,
    available: number
  ): never {
    const error = new Error(
      `Stock changed for "${title}". Requested ${requested}, but only ${available} left.`
    );
    (error as any).reason = 'STOCK_CHANGED';
    (error as any).productId = productId;
    (error as any).requestedQuantity = requested;
    (error as any).availableQuantity = available;
    throw error;
  }

  private throwReservationNotFound(reservationId: string): never {
    const error = new Error(`Reservation not found: ${reservationId}`);
    (error as any).reason = 'RESERVATION_EXPIRED';
    throw error;
  }

  private throwReservationInvalid(reservationId: string, status: string): never {
    const error = new Error(`Reservation is no longer active: ${status}`);
    (error as any).reason = 'RESERVATION_EXPIRED';
    throw error;
  }

  private throwReservationExpired(reservationId: string): never {
    const error = new Error(`Reservation expired: ${reservationId}`);
    (error as any).reason = 'RESERVATION_EXPIRED';
    throw error;
  }
}
