import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, map } from 'rxjs';
import { Product } from '../models/product';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export type SimulatedCheckoutFailureMode = 'none' | 'checkout-unavailable' | 'stock-changed';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly themeStorageKey = 'theme';

  readonly currentUser$ = this.authService.currentUser$;

  private cartItemsSubject = new BehaviorSubject<Product[]>([]);
  readonly cartItems$ = this.cartItemsSubject.asObservable();
  readonly cartCount$ = this.cartItems$.pipe(map((items) => items.length));

  private cartOpenSubject = new BehaviorSubject<boolean>(false);
  readonly cartOpen$ = this.cartOpenSubject.asObservable();

  private simulateFailuresSubject = new BehaviorSubject<boolean>(
    environment.features.simulateBackendFailuresDefault
  );
  readonly simulateFailures$ = this.simulateFailuresSubject.asObservable();

  private simulateCheckoutFailureModeSubject = new BehaviorSubject<SimulatedCheckoutFailureMode>('none');
  readonly simulateCheckoutFailureMode$ = this.simulateCheckoutFailureModeSubject.asObservable();

  private themeSubject = new BehaviorSubject<'light' | 'dark'>('light');
  readonly theme$ = this.themeSubject.asObservable();

  private currentUserId = 'guest';

  constructor(
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.initializeFeatureFlagsFromStorage();

    this.authService.currentUser$.subscribe((user) => {
      this.currentUserId = user?.id ?? 'guest';
      this.hydrateCartForCurrentUser();
    });
  }

  addToCart(product: Product): void {
    const maxQuantity = this.getMaxQuantity(product);
    if (maxQuantity <= 0) {
      return;
    }

    const currentQuantity = this.cartItemsSubject.value.filter((item) => item.id === product.id).length;
    if (currentQuantity >= maxQuantity) {
      return;
    }

    const updated = [...this.cartItemsSubject.value, product];
    this.cartItemsSubject.next(updated);
    this.persistCart(updated);
  }

  setCartItemQuantity(productId: number, quantity: number): void {
    const currentItems = this.cartItemsSubject.value;
    const matchingItem = currentItems.find((item) => item.id === productId);

    if (!matchingItem) {
      return;
    }

    const maxQuantity = this.getMaxQuantity(matchingItem);
    const nextQuantity = Math.min(maxQuantity, Math.max(0, Math.floor(quantity)));

    const remainingItems = currentItems.filter((item) => item.id !== productId);
    const replenishedItems = Array.from({ length: nextQuantity }, () => matchingItem);
    const updated = [...remainingItems, ...replenishedItems];

    this.cartItemsSubject.next(updated);
    this.persistCart(updated);
  }

  clearCart(): void {
    this.cartItemsSubject.next([]);
    this.persistCart([]);
  }

  toggleCart(): void {
    this.cartOpenSubject.next(!this.cartOpenSubject.value);
  }

  setCartOpen(open: boolean): void {
    this.cartOpenSubject.next(open);
  }

  get cartOpenValue(): boolean {
    return this.cartOpenSubject.value;
  }

  setSimulateFailures(enabled: boolean): void {
    this.simulateFailuresSubject.next(enabled);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('simulateFailures', String(enabled));
    }

    if (!enabled) {
      this.setSimulatedCheckoutFailureMode('none');
    }
  }

  get simulateFailuresValue(): boolean {
    return this.simulateFailuresSubject.value;
  }

  setSimulatedCheckoutFailureMode(mode: SimulatedCheckoutFailureMode): void {
    this.simulateCheckoutFailureModeSubject.next(mode);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('simulateCheckoutFailureMode', mode);
    }
  }

  get simulatedCheckoutFailureModeValue(): SimulatedCheckoutFailureMode {
    return this.simulateCheckoutFailureModeSubject.value;
  }

  initializeFeatureFlagsFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const stored = localStorage.getItem('simulateFailures');
    if (stored !== null && environment.features.allowSimulatedFailureToggle) {
      this.simulateFailuresSubject.next(stored === 'true');
    }

    const storedCheckoutFailureMode = localStorage.getItem('simulateCheckoutFailureMode');
    if (
      storedCheckoutFailureMode === 'none' ||
      storedCheckoutFailureMode === 'checkout-unavailable' ||
      storedCheckoutFailureMode === 'stock-changed'
    ) {
      this.simulateCheckoutFailureModeSubject.next(storedCheckoutFailureMode);
    }

    const savedTheme = localStorage.getItem(this.themeStorageKey);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      this.themeSubject.next(savedTheme);
    }
  }

  toggleTheme(): void {
    const next = this.themeSubject.value === 'light' ? 'dark' : 'light';
    this.setTheme(next);
  }

  setTheme(theme: 'light' | 'dark'): void {
    this.themeSubject.next(theme);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.themeStorageKey, theme);
    }
  }

  get themeValue(): 'light' | 'dark' {
    return this.themeSubject.value;
  }

  private hydrateCartForCurrentUser(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.cartItemsSubject.next([]);
      return;
    }

    const saved = localStorage.getItem(this.cartStorageKey());
    this.cartItemsSubject.next(saved ? (JSON.parse(saved) as Product[]) : []);
  }

  private persistCart(items: Product[]): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.cartStorageKey(), JSON.stringify(items));
  }

  private cartStorageKey(): string {
    return `cart:${this.currentUserId}`;
  }

  private getMaxQuantity(product: Product): number {
    if (!product.inStock) {
      return 0;
    }

    const rawLimit = product.stockCount ?? 5;
    return Math.max(0, Math.floor(rawLimit));
  }
}
