import { Component, OnDestroy, OnInit } from '@angular/core';
import { ProductService } from '../services/product.service';
import { ToastService } from '../services/toast.service';
import { Product } from '../models/product';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';
import { AppStateService, SimulatedCheckoutFailureMode } from '../services/app-state.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit, OnDestroy {
  private readonly lowStockThreshold = 2;
  products: Product[] = [];
  categories: string[] = [];
  searchTerm: string = '';
  selectedCategory: string = '';
  sortBy: string = '';
  minRating: number = 0;
  simulateFailures = environment.features.simulateBackendFailuresDefault;
  simulateCheckoutFailureMode: SimulatedCheckoutFailureMode = 'none';
  readonly showSimulatedFailureToggle = environment.features.allowSimulatedFailureToggle;
  private cartQuantityByProductId = new Map<number, number>();
  private authSubscription?: Subscription;
  private cartSubscription?: Subscription;

  constructor(
    private productService: ProductService,
    private toastService: ToastService,
    private authService: AuthService,
    private appState: AppStateService
  ) {}

  ngOnInit() {
    this.simulateFailures = this.appState.simulateFailuresValue;
    this.simulateCheckoutFailureMode = this.appState.simulatedCheckoutFailureModeValue;

    this.cartSubscription = this.appState.cartItems$.subscribe((items) => {
      const counts = new Map<number, number>();
      for (const item of items) {
        counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
      }
      this.cartQuantityByProductId = counts;
    });

    this.authSubscription = this.authService.currentUser$.subscribe((user) => {
      if (!user) {
        this.products = [];
        this.categories = [];
        return;
      }

      this.productService.setSimulateFailures(this.simulateFailures);
      this.loadProducts();
    });
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.cartSubscription?.unsubscribe();
  }

  get filteredProducts(): Product[] {
    let filtered = this.products.filter((product) =>
      (!this.selectedCategory || product.category === this.selectedCategory) &&
      (product.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );

    filtered = filtered.filter((product) => !this.minRating || (product.rating ?? 0) >= this.minRating);

    if (this.sortBy === 'priceLowHigh') {
      filtered = filtered.sort((a, b) => a.price - b.price);
    } else if (this.sortBy === 'priceHighLow') {
      filtered = filtered.sort((a, b) => b.price - a.price);
    } else if (this.sortBy === 'rating') {
      filtered = filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }

    return filtered;
  }

  addToCart(product: Product) {
    this.appState.addToCart(product);
    this.toastService.show(`Added "${product.title}" to cart!`);
    this.sendInstrumentation('addToCart', product);
  }

  getRemainingStock(product: Product): number {
    const maxQuantity = this.getMaxQuantity(product);
    const currentQuantity = this.cartQuantityByProductId.get(product.id) ?? 0;
    return Math.max(0, maxQuantity - currentQuantity);
  }

  isLowStock(product: Product): boolean {
    const remaining = this.getRemainingStock(product);
    return remaining > 0 && remaining <= this.lowStockThreshold;
  }

  getStockStateLabel(product: Product): 'In Stock' | 'Low Stock' | 'Out of Stock' {
    const state = this.getStockState(product);
    if (state === 'low-stock') {
      return 'Low Stock';
    }

    if (state === 'in-stock') {
      return 'In Stock';
    }

    return 'Out of Stock';
  }

  getStockStateClass(product: Product): string {
    return `stock-state stock-state--${this.getStockState(product)}`;
  }

  onSimulatedFailuresChange(): void {
    this.appState.setSimulateFailures(this.simulateFailures);
    this.productService.setSimulateFailures(this.simulateFailures);

    if (!this.simulateFailures) {
      this.simulateCheckoutFailureMode = 'none';
    }

    this.loadProducts();
    this.toastService.show(
      `Simulated backend failures ${this.simulateFailures ? 'enabled' : 'disabled'}.`
    );
    this.sendInstrumentation('toggleSimulatedFailures', { enabled: this.simulateFailures });
  }

  onCheckoutFailureModeChange(): void {
    this.appState.setSimulatedCheckoutFailureMode(this.simulateCheckoutFailureMode);
    this.toastService.show(`Checkout failure mode set to ${this.simulateCheckoutFailureMode}.`);
    this.sendInstrumentation('setCheckoutFailureMode', { mode: this.simulateCheckoutFailureMode });
  }

  private loadProducts(): void {
    this.productService.getProducts$().subscribe({
      next: (products) => {
        this.products = products;
        this.categories = Array.from(new Set(this.products.map((product) => product.category))).filter(
          (category): category is string => Boolean(category)
        );
      },
      error: (error) => {
        this.toastService.show((error as Error).message);
        this.products = [];
        this.categories = [];
      }
    });
  }

  sendInstrumentation(event: string, data?: unknown): void {
    if (!environment.features.enableInstrumentation) {
      return;
    }
    console.log('[Instrumentation]', event, data);
  }

  private getMaxQuantity(product: Product): number {
    if (!product.inStock) {
      return 0;
    }

    const rawLimit = product.stockCount ?? 5;
    return Math.max(0, Math.floor(rawLimit));
  }

  getStockState(product: Product): 'in-stock' | 'low-stock' | 'out-of-stock' {
    const remaining = this.getRemainingStock(product);
    if (remaining <= 0) {
      return 'out-of-stock';
    }

    if (remaining <= this.lowStockThreshold) {
      return 'low-stock';
    }

    return 'in-stock';
  }

}