import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import {
  CheckoutConfirmation,
  CheckoutRequest,
  isCheckoutError,
  PaymentDetails,
  ShippingDetails,
} from '../models/checkout';
import { NewOrder } from '../models/order';
import { Product } from '../models/product';
import { AppStateService } from '../services/app-state.service';
import { AuthService } from '../services/auth.service';
import { CheckoutService } from '../services/checkout.service';
import { OrderService } from '../services/order.service';
import { ToastService } from '../services/toast.service';

interface CheckoutLineItem {
  product: Product;
  quantity: number;
  lineTotal: number;
}

type CheckoutStep = 'shipping' | 'payment' | 'review' | 'success';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  step: CheckoutStep = 'shipping';
  isSubmitting = false;
  errorMessage: string | null = null;
  orderConfirmation: CheckoutConfirmation | null = null;
  formSubmitted = false;

  cartItems: Product[] = [];

  shipping: ShippingDetails = {
    fullName: '',
    addressLine1: '',
    city: '',
    state: '',
    zip: '',
  };

  payment: PaymentDetails = {
    method: 'card',
    cardLast4: '',
  };

  constructor(
    private appState: AppStateService,
    private checkoutService: CheckoutService,
    private orderService: OrderService,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router
  ) {
    this.appState.cartItems$
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        this.cartItems = items;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get subtotal(): number {
    return this.cartItems.reduce((sum, item) => sum + item.price, 0);
  }

  get cartLineItems(): CheckoutLineItem[] {
    const grouped = new Map<number, CheckoutLineItem>();

    for (const item of this.cartItems) {
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

  goToPayment(): void {
    this.formSubmitted = true;
    if (!this.isShippingValid()) {
      this.errorMessage = 'Please complete all shipping fields.';
      return;
    }

    this.errorMessage = null;
    this.step = 'payment';
  }

  goToReview(): void {
    this.formSubmitted = true;
    if (!this.isPaymentValid()) {
      this.errorMessage = 'Please provide valid payment details.';
      return;
    }

    this.errorMessage = null;
    this.step = 'review';
  }

  backToShipping(): void {
    this.errorMessage = null;
    this.formSubmitted = false;
    this.step = 'shipping';
  }

  backToPayment(): void {
    this.errorMessage = null;
    this.formSubmitted = false;
    this.step = 'payment';
  }

  async goBack(): Promise<void> {
    if (this.step === 'review') {
      this.backToPayment();
      return;
    }

    if (this.step === 'payment') {
      this.backToShipping();
      return;
    }

    if (this.step === 'shipping') {
      await this.router.navigate(['/cart']);
      return;
    }

    await this.router.navigate(['/']);
  }

  async placeOrder(): Promise<void> {
    if (!this.cartItems.length) {
      this.errorMessage = 'Your cart is empty. Add items before placing an order.';
      return;
    }

    if (!this.isShippingValid() || !this.isPaymentValid()) {
      this.errorMessage = 'Please complete checkout details before placing your order.';
      return;
    }

    const request: CheckoutRequest = {
      items: this.cartItems,
      total: this.subtotal,
      shipping: this.shipping,
      payment: this.payment,
    };

    this.isSubmitting = true;
    this.errorMessage = null;

    try {
      const confirmation = await this.checkoutService.placeOrder(request);
      await firstValueFrom(this.orderService.createOrder(this.buildOrderRecord(confirmation)));
      this.orderConfirmation = confirmation;
      this.appState.clearCart();
      this.appState.setCartOpen(false);
      this.toastService.show(`Order ${this.orderConfirmation.orderId} placed successfully!`);
      this.step = 'success';
    } catch (error) {
      this.errorMessage = this.resolveCheckoutErrorMessage(error);
      this.toastService.show('Checkout failed. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }

  async continueShopping(): Promise<void> {
    await this.router.navigate(['/']);
  }

  private buildOrderRecord(confirmation: CheckoutConfirmation): NewOrder {
    const user = this.authService.currentUserValue;
    if (!user) {
      throw new Error('You must be signed in to place an order.');
    }

    return {
      orderNumber: confirmation.orderId,
      userId: user.id,
      userName: user.name,
      tenantId: user.tenantId,
      createdAt: confirmation.placedAtIso,
      status: 'pending',
      subtotal: this.subtotal,
      total: this.subtotal,
      totalItems: this.cartItems.length,
      shippingAddress: { ...this.shipping },
      paymentMethod: this.payment.method,
      items: this.cartLineItems.map((line) => ({
        productId: line.product.id,
        title: line.product.title,
        price: line.product.price,
        quantity: line.quantity,
        imageUrl: line.product.imageUrl,
      })),
    };
  }

  private isShippingValid(): boolean {
    return (
      !!this.shipping.fullName.trim() &&
      !!this.shipping.addressLine1.trim() &&
      !!this.shipping.city.trim() &&
      !!this.shipping.state.trim() &&
      !!this.shipping.zip.trim()
    );
  }

  private isPaymentValid(): boolean {
    if (this.payment.method === 'paypal') {
      return true;
    }

    return /^\d{4}$/.test(this.payment.cardLast4?.trim() || '');
  }

  private resolveCheckoutErrorMessage(error: unknown): string {
    if (isCheckoutError(error)) {
      return error.failure.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unable to place order right now.';
  }
}
