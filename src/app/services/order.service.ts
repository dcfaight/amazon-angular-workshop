import { Injectable } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Order, NewOrder, OrderStatus, getNextOrderStatus } from '../models/order';
import { AuthService } from './auth.service';
import { User } from '../models/user';

interface LegacyOrderItem {
  productId: number;
  title: string;
  price?: number;
  unitPrice?: number;
  quantity: number;
  imageUrl?: string;
}

type LegacyOrderStatus = OrderStatus | 'placed' | 'processing' | 'delivered';

type LegacyOrderRecord = Omit<Partial<Order>, 'items' | 'status'> & {
  items?: LegacyOrderItem[];
  status?: LegacyOrderStatus;
};

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly apiUrl = 'http://192.168.1.5:3000/orders';
  private readonly localStoragePrefix = 'orders';

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getOrdersForCurrentUser(): Observable<Order[]> {
    const user = this.authService.currentUserValue;
    if (!user) {
      return of([]);
    }

    return this.http
      .get<Order[]>(`${this.apiUrl}?userId=${encodeURIComponent(user.id)}`)
      .pipe(
        map((orders) => this.mergeOrders(this.normalizeOrders(orders, user), this.readLocalOrders(user), user)),
        catchError(() => of(this.mergeOrders([], this.readLocalOrders(user), user))),
        map((orders) =>
          [...orders].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        )
      );
  }

  createOrder(order: NewOrder): Observable<Order> {
    const pendingOrder = this.buildLocalOrder(order);

    return this.http.post<Order>(this.apiUrl, order).pipe(
      tap((createdOrder) => this.saveLocalOrder(createdOrder)),
      catchError(() => {
        this.saveLocalOrder(pendingOrder);
        return of(pendingOrder);
      })
    );
  }

  advanceOrderStatus(order: Order): Observable<Order> {
    const nextStatus = getNextOrderStatus(order.status);
    if (!nextStatus) {
      return of(order);
    }

    const updatedOrder: Order = {
      ...order,
      status: nextStatus,
    };

    return this.http.patch<Order>(`${this.apiUrl}/${order.id}`, { status: nextStatus }).pipe(
      map((savedOrder) => this.normalizeOrder({ ...order, ...savedOrder }, this.resolveUser(order))),
      tap((savedOrder) => this.saveLocalOrder(savedOrder)),
      catchError(() => {
        this.saveLocalOrder(updatedOrder);
        return of(updatedOrder);
      })
    );
  }

  private normalizeOrders(rawOrders: LegacyOrderRecord[], user: User): Order[] {
    if (!rawOrders.length) {
      return this.buildSeedOrders(user);
    }

    return rawOrders.map((order) => this.normalizeOrder(order, user));
  }

  private normalizeOrder(rawOrder: LegacyOrderRecord, user: User): Order {
    const items = (rawOrder.items ?? []).map((item) => ({
      productId: item.productId,
      title: item.title,
      price: item.price ?? item.unitPrice ?? 0,
      quantity: item.quantity,
      imageUrl: item.imageUrl ?? 'https://via.placeholder.com/80',
    }));

    const shippingAddress = rawOrder.shippingAddress ?? {
      fullName: rawOrder.userName ?? user.name,
      addressLine1: 'Shipping details not available in this legacy order.',
      city: user.tenantId,
      state: '—',
      zip: '—',
    };

    const paymentMethod = rawOrder.paymentMethod ?? 'card';
    const totalItems = rawOrder.totalItems ?? items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = rawOrder.subtotal ?? rawOrder.total ?? items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      id: rawOrder.id ?? `legacy-${user.id}-${rawOrder.orderNumber ?? Date.now()}`,
      orderNumber: rawOrder.orderNumber ?? String(rawOrder.id ?? `ORD-${Date.now()}`),
      userId: String(rawOrder.userId ?? user.id),
      userName: rawOrder.userName ?? user.name,
      tenantId: rawOrder.tenantId ?? user.tenantId,
      createdAt: rawOrder.createdAt ?? new Date().toISOString(),
      status: this.normalizeStatus(rawOrder.status),
      subtotal,
      total: rawOrder.total ?? subtotal,
      totalItems,
      shippingAddress,
      paymentMethod,
      items,
      isSeeded: rawOrder.isSeeded,
    };
  }

  private mergeOrders(baseOrders: Order[], localOrders: Order[], user: User): Order[] {
    const seen = new Set<string>();
    const merged: Order[] = [];

    for (const order of [...localOrders, ...baseOrders]) {
      const normalized = this.normalizeOrder(order as LegacyOrderRecord, user);
      const key = normalized.orderNumber || String(normalized.id);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(normalized);
    }

    return merged.length ? merged : this.buildSeedOrders(user);
  }

  private buildLocalOrder(order: NewOrder): Order {
    return {
      ...order,
      id: `local-${Date.now()}`,
      orderNumber: order.orderNumber,
      userId: order.userId,
      userName: order.userName,
      tenantId: order.tenantId,
      createdAt: order.createdAt,
      status: order.status,
      subtotal: order.subtotal,
      total: order.total,
      totalItems: order.totalItems,
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod,
      items: order.items,
      isSeeded: false,
    };
  }

  private readLocalOrders(user: User): Order[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    const raw = localStorage.getItem(this.localOrdersKey(user.id));
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as Order[];
    } catch {
      return [];
    }
  }

  private saveLocalOrder(order: Order): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const userOrders = this.readLocalOrdersByUserId(order.userId).filter(
      (existing) => existing.orderNumber !== order.orderNumber
    );
    userOrders.push(order);
    localStorage.setItem(this.localOrdersKey(order.userId), JSON.stringify(userOrders));
  }

  private readLocalOrdersByUserId(userId: string): Order[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    const raw = localStorage.getItem(this.localOrdersKey(userId));
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as Order[];
    } catch {
      return [];
    }
  }

  private localOrdersKey(userId: string): string {
    return `${this.localStoragePrefix}:${userId}`;
  }

  private normalizeStatus(status: LegacyOrderRecord['status']): OrderStatus {
    switch (status) {
      case 'confirmed':
      case 'processing':
        return 'confirmed';
      case 'shipped':
      case 'delivered':
        return 'shipped';
      case 'pending':
      case 'placed':
      default:
        return 'pending';
    }
  }

  private resolveUser(order: Pick<Order, 'userId' | 'userName' | 'tenantId'>): User {
    const currentUser = this.authService.currentUserValue;
    if (currentUser && currentUser.id === order.userId) {
      return currentUser;
    }

    return {
      id: order.userId,
      name: order.userName,
      tenantId: order.tenantId,
      roles: [],
    };
  }

  private buildSeedOrders(user: User): Order[] {
    const baseAddress = {
      fullName: user.name,
      addressLine1: '123 Market Street',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };

    return [
      {
        id: `seed-${user.id}-1`,
        orderNumber: 'ORD-DEMO-401',
        userId: user.id,
        userName: user.name,
        tenantId: user.tenantId,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
        status: 'confirmed',
        subtotal: 239.98,
        total: 239.98,
        totalItems: 2,
        shippingAddress: baseAddress,
        paymentMethod: 'card',
        isSeeded: true,
        items: [
          {
            productId: 101,
            title: 'Noise Cancelling Headphones',
            price: 199.99,
            quantity: 1,
            imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/61SUj2aKoEL._AC_SL1500_.jpg',
          },
          {
            productId: 102,
            title: 'USB-C Fast Charger',
            price: 39.99,
            quantity: 1,
            imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/51smZdVynAL._AC_SX522_.jpg',
          },
        ],
      },
      {
        id: `seed-${user.id}-2`,
        orderNumber: 'ORD-DEMO-318',
        userId: user.id,
        userName: user.name,
        tenantId: user.tenantId,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
        status: 'shipped',
        subtotal: 89.5,
        total: 89.5,
        totalItems: 1,
        shippingAddress: baseAddress,
        paymentMethod: 'paypal',
        isSeeded: true,
        items: [
          {
            productId: 103,
            title: 'Smart LED Bulb Pack',
            price: 89.5,
            quantity: 1,
            imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/71CxlvZekJL._AC_SX466_.jpg',
          },
        ],
      },
      {
        id: `seed-${user.id}-3`,
        orderNumber: 'ORD-DEMO-217',
        userId: user.id,
        userName: user.name,
        tenantId: user.tenantId,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
        status: 'pending',
        subtotal: 24.99,
        total: 24.99,
        totalItems: 1,
        shippingAddress: baseAddress,
        paymentMethod: 'card',
        isSeeded: true,
        items: [
          {
            productId: 104,
            title: 'Portable Mouse',
            price: 24.99,
            quantity: 1,
            imageUrl: 'https://images-na.ssl-images-amazon.com/images/I/61LtuGzXeaL._AC_SX450_.jpg',
          },
        ],
      },
    ];
  }
}
