import { Injectable } from '@angular/core';
import { CheckoutConfirmation, CheckoutError, CheckoutRequest } from '../models/checkout';
import { AppStateService } from './app-state.service';
import { Product } from '../models/product';
import { PaymentService } from './payment.service';
import { ReservationService } from './reservation.service';

interface CheckoutLine {
  productId: number;
  title: string;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  constructor(
    private appState: AppStateService,
    private reservationService: ReservationService,
    private paymentService: PaymentService
  ) {}

  async placeOrder(request: CheckoutRequest): Promise<CheckoutConfirmation> {
    if (!request.items.length) {
      throw new Error('Your cart is empty. Add items before checking out.');
    }

    const checkoutLines = this.buildCheckoutLines(request.items);

    await this.simulateNetworkLatency();
    this.applyDeterministicFailureMode(checkoutLines);

    // Use ReservationService for atomic stock operations.
    let reservationId: string | null = null;

    try {
      // Step 1: Validate and reserve stock (5-minute hold).
      reservationId = await this.reservationService.validateAndReserve(checkoutLines);

      await this.simulateNetworkLatency();

      // Step 2: Confirm the reservation (persist stock changes).
      await this.paymentService.processPayment(request.payment, request.total);

      await this.simulateNetworkLatency();

      // Step 3: Confirm the reservation (persist stock changes).
      await this.reservationService.confirmReservation(reservationId);

      await this.simulateNetworkLatency();

      const totalItems = checkoutLines.reduce((sum, line) => sum + line.quantity, 0);

      return {
        orderId: `ORD-${Date.now()}`,
        placedAtIso: new Date().toISOString(),
        total: request.total,
        itemCount: totalItems,
        etaDays: 3,
      };
    } catch (error) {
      // Step 3: Cancel reservation on failure to free up stock for other customers.
      if (reservationId) {
        this.reservationService.cancelReservation(reservationId);
      }

      // Convert native errors to typed CheckoutError
      if (error instanceof CheckoutError) {
        throw error;
      }

      if (error instanceof Error) {
        const reason = (error as any).reason || 'CHECKOUT_UNAVAILABLE';
        throw new CheckoutError({
          reason: reason as any,
          message: error.message,
          productId: (error as any).productId,
          requestedQuantity: (error as any).requestedQuantity,
          availableQuantity: (error as any).availableQuantity,
        });
      }

      throw new CheckoutError({
        reason: 'CHECKOUT_UNAVAILABLE',
        message: 'Checkout failed. Please try again.',
      });
    }
  }

  private buildCheckoutLines(items: Product[]): CheckoutLine[] {
    const grouped = new Map<number, CheckoutLine>();

    for (const item of items) {
      const existing = grouped.get(item.id);
      if (existing) {
        existing.quantity += 1;
        continue;
      }

      grouped.set(item.id, {
        productId: item.id,
        title: item.title,
        quantity: 1,
      });
    }

    return Array.from(grouped.values());
  }

  private applyDeterministicFailureMode(lines: CheckoutLine[]): void {
    const mode = this.appState.simulatedCheckoutFailureModeValue;

    if (mode === 'checkout-unavailable' || (this.appState.simulateFailuresValue && mode === 'none')) {
      throw new CheckoutError({
        reason: 'CHECKOUT_UNAVAILABLE',
        message: 'Checkout is temporarily unavailable. Please try again.',
      });
    }

    if (mode === 'stock-changed') {
      const firstLine = lines[0];
      const availableQuantity = Math.max(0, firstLine.quantity - 1);
      throw new CheckoutError({
        reason: 'INSUFFICIENT_STOCK',
        message: `Stock changed for "${firstLine.title}". Requested ${firstLine.quantity}, but only ${availableQuantity} left.`,
        productId: firstLine.productId,
        requestedQuantity: firstLine.quantity,
        availableQuantity,
      });
    }
  }

  private async simulateNetworkLatency(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
}
