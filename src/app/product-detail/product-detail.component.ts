import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Location } from '@angular/common';
import { ProductService } from '../services/product.service';
import { ToastService } from '../services/toast.service';
import { Product } from '../models/product';
import { AppStateService } from '../services/app-state.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  private readonly lowStockThreshold = 2;
  private readonly destroy$ = new Subject<void>();
  @Input() product: Product | null = null;
  private cartItems: Product[] = [];
  cartQuantityForProduct = 0;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private toastService: ToastService,
    private appState: AppStateService,
    private location: Location
  ) {}

  ngOnInit() {
    this.appState.cartItems$
      .pipe(takeUntil(this.destroy$))
      .subscribe((items) => {
        this.cartItems = items;
        if (!this.product) {
          this.cartQuantityForProduct = 0;
          return;
        }

        this.cartQuantityForProduct = items.filter((item) => item.id === this.product?.id).length;
      });

    if (this.product) {
      return;
    }

    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.productService.getById$(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (loadedProduct) => {
          if (!loadedProduct) {
            this.product = null;
            this.cartQuantityForProduct = 0;
            return;
          }

          this.product = loadedProduct;
          this.cartQuantityForProduct = this.getCartQuantityFor(loadedProduct.id);
        },
        error: (error) => {
          this.toastService.show((error as Error).message);
          this.product = null;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.location.back();
  }

  isAddToCartDisabled(product: Product): boolean {
    if (!product.inStock) {
      return true;
    }

    return this.cartQuantityForProduct >= this.getMaxQuantity(product);
  }

  addToCart(product: Product): void {
    this.appState.addToCart(product);
    this.toastService.show(`Added "${product.title}" to cart!`);
    this.cartQuantityForProduct = this.getCartQuantityFor(product.id);
  }

  getRemainingStock(product: Product): number {
    return Math.max(0, this.getMaxQuantity(product) - this.cartQuantityForProduct);
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

  private getCartQuantityFor(productId: number): number {
    return this.cartItems.filter((item) => item.id === productId).length;
  }

  private getMaxQuantity(product: Product): number {
    const rawLimit = product.stockCount ?? 5;
    return Math.max(0, Math.floor(rawLimit));
  }

  public getStockState(product: Product): 'in-stock' | 'low-stock' | 'out-of-stock' {
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