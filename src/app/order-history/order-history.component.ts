import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Order } from '../models/order';
import { OrderService } from '../services/order.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './order-history.component.html',
  styleUrl: './order-history.component.scss',
})
export class OrderHistoryComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  readonly statusSteps: Order['status'][] = ['placed', 'processing', 'shipped', 'delivered'];

  orders: Order[] = [];
  loading = true;
  errorMessage: string | null = null;

  constructor(
    private orderService: OrderService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrders(): void {
    this.loading = true;
    this.errorMessage = null;

    this.orderService.getOrdersForCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          this.orders = orders;
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'Unable to load your order history right now.';
          this.loading = false;
          this.toastService.show('Failed to load order history.');
        },
      });
  }

  trackByOrderId(_index: number, order: Order): string | number {
    return order.id;
  }

  getStatusClass(order: Order): string {
    return `status-pill ${order.status}`;
  }

  getOrderNumber(order: Order): string {
    return order.orderNumber || String(order.id);
  }

  getShippingName(order: Order): string {
    return order.shippingAddress?.fullName || order.userName;
  }

  getShippingLine1(order: Order): string {
    return order.shippingAddress?.addressLine1 || 'Shipping details not available for this order.';
  }

  getShippingCityLine(order: Order): string {
    const { city, state, zip } = order.shippingAddress ?? { city: '', state: '', zip: '' };
    const parts = [city, state, zip].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Legacy order record';
  }

  getPaymentLabel(order: Order): string {
    return order.paymentMethod ? order.paymentMethod.toUpperCase() : 'N/A';
  }

  getStatusIndex(order: Order): number {
    return this.statusSteps.indexOf(order.status);
  }

  isStepReached(order: Order, step: Order['status']): boolean {
    return this.getStatusIndex(order) >= this.statusSteps.indexOf(step);
  }
}
