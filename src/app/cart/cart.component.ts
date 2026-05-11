import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AppStateService } from '../services/app-state.service';
import { Product } from '../models/product';

interface CartLineItem {
  product: Product;
  quantity: number;
  lineTotal: number;
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss'
})
export class CartComponent {
  private readonly lowStockThreshold = 2;
  cartItems$ = this.appState.cartItems$;
  cartLineItems$ = this.appState.cartItems$.pipe(map((items) => this.toLineItems(items)));
  cartTotal$ = this.appState.cartItems$.pipe(
    map((items) => items.reduce((sum, item) => sum + item.price, 0))
  );

  constructor(private appState: AppStateService) {}

  clearCart(): void {
    this.appState.clearCart();
  }

  increaseQuantity(productId: number, currentQuantity: number): void {
    this.appState.setCartItemQuantity(productId, currentQuantity + 1);
  }

  decreaseQuantity(productId: number, currentQuantity: number): void {
    this.appState.setCartItemQuantity(productId, currentQuantity - 1);
  }

  removeItem(productId: number): void {
    this.appState.setCartItemQuantity(productId, 0);
  }

  isIncreaseDisabled(product: Product, quantity: number): boolean {
    const maxQuantity = this.getMaxQuantity(product);
    return maxQuantity <= 0 || quantity >= maxQuantity;
  }

  getRemainingStock(product: Product, quantity: number): number {
    const maxQuantity = this.getMaxQuantity(product);
    return Math.max(0, maxQuantity - quantity);
  }

  isLowStock(product: Product, quantity: number): boolean {
    const remaining = this.getRemainingStock(product, quantity);
    return remaining > 0 && remaining <= this.lowStockThreshold;
  }

  getStockStateLabel(product: Product, quantity: number): 'In Stock' | 'Low Stock' | 'Out of Stock' {
    const state = this.getStockState(product, quantity);
    if (state === 'low-stock') {
      return 'Low Stock';
    }

    if (state === 'in-stock') {
      return 'In Stock';
    }

    return 'Out of Stock';
  }

  getStockStateClass(product: Product, quantity: number): string {
    return `stock-state stock-state--${this.getStockState(product, quantity)}`;
  }

  private toLineItems(items: Product[]): CartLineItem[] {
    const grouped = new Map<number, CartLineItem>();

    for (const item of items) {
      const existing = grouped.get(item.id);
      if (existing) {
        existing.quantity += 1;
        existing.lineTotal += item.price;
        continue;
      }

      grouped.set(item.id, {
        product: item,
        quantity: 1,
        lineTotal: item.price,
      });
    }

    return Array.from(grouped.values());
  }

  private getMaxQuantity(product: Product): number {
    if (!product.inStock) {
      return 0;
    }

    const rawLimit = product.stockCount ?? 5;
    return Math.max(0, Math.floor(rawLimit));
  }

  getStockState(product: Product, quantity: number): 'in-stock' | 'low-stock' | 'out-of-stock' {
    const remaining = this.getRemainingStock(product, quantity);
    if (remaining <= 0) {
      return 'out-of-stock';
    }

    if (remaining <= this.lowStockThreshold) {
      return 'low-stock';
    }

    return 'in-stock';
  }

}
