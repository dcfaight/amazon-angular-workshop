import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  CheckoutConfirmation,
  CheckoutError,
  CheckoutRequest,
} from '../models/checkout';
import { AppStateService } from './app-state.service';
import { Product } from '../models/product';
import { firstValueFrom } from 'rxjs';

interface CheckoutLine {
  productId: number;
  title: string;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly apiUrl = 'http://192.168.1.5:3000/products';

  constructor(
    private appState: AppStateService,
    private http: HttpClient
  ) {}

  async placeOrder(request: CheckoutRequest): Promise<CheckoutConfirmation> {
    if (!request.items.length) {
      throw new Error('Your cart is empty. Add items before checking out.');
    }

    const checkoutLines = this.buildCheckoutLines(request.items);

    await this.simulateNetworkLatency();
    this.applyDeterministicFailureMode(checkoutLines);

    // Reserve inventory right before order confirmation.
    await this.reserveStock(checkoutLines);

    await this.simulateNetworkLatency();

    const totalItems = checkoutLines.reduce((sum, line) => sum + line.quantity, 0);

    return {
      orderId: `ORD-${Date.now()}`,
      placedAtIso: new Date().toISOString(),
      total: request.total,
      itemCount: totalItems,
      etaDays: 3,
    };
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

  private async reserveStock(lines: CheckoutLine[]): Promise<void> {
    for (const line of lines) {
      const latestProduct = await this.getProductById(line.productId, line.title, line.quantity);
      const availableStock = this.getAvailableStock(latestProduct);

      if (!latestProduct.inStock || availableStock < line.quantity) {
        throw new CheckoutError({
          reason: 'INSUFFICIENT_STOCK',
          message: `Stock changed for "${latestProduct.title}". Requested ${line.quantity}, but only ${availableStock} left.`,
          productId: line.productId,
          requestedQuantity: line.quantity,
          availableQuantity: availableStock,
        });
      }

      const nextStock = availableStock - line.quantity;
      const updatedProduct: Product = {
        ...latestProduct,
        stockCount: nextStock,
        inStock: nextStock > 0,
      };

      await this.updateProductStock(updatedProduct, line.title);
    }
  }

  private async getProductById(
    productId: number,
    title: string,
    requestedQuantity: number
  ): Promise<Product> {
    try {
      const product = await firstValueFrom(this.http.get<Product>(`${this.apiUrl}/${productId}`));
      if (!product) {
        throw new CheckoutError({
          reason: 'PRODUCT_NOT_FOUND',
          message: `Product "${title}" is no longer available.`,
          productId,
          requestedQuantity,
          availableQuantity: 0,
        });
      }

      return product;
    } catch (error) {
      if (error instanceof CheckoutError) {
        throw error;
      }

      if (error instanceof HttpErrorResponse && error.status === 404) {
        throw new CheckoutError({
          reason: 'PRODUCT_NOT_FOUND',
          message: `Product "${title}" is no longer available.`,
          productId,
          requestedQuantity,
          availableQuantity: 0,
        });
      }

      throw new CheckoutError({
        reason: 'CHECKOUT_UNAVAILABLE',
        message: 'Unable to validate stock right now. Please try again.',
      });
    }
  }

  private async updateProductStock(product: Product, title: string): Promise<void> {
    try {
      await firstValueFrom(this.http.put<Product>(`${this.apiUrl}/${product.id}`, product));
    } catch {
      throw new CheckoutError({
        reason: 'CHECKOUT_UNAVAILABLE',
        message: `Could not reserve stock for "${title}". Please try again.`,
        productId: product.id,
      });
    }
  }

  private getAvailableStock(product: Product): number {
    if (!product.inStock) {
      return 0;
    }

    const raw = product.stockCount ?? 5;
    return Math.max(0, Math.floor(raw));
  }

  private async simulateNetworkLatency(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
}
