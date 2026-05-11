import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminService } from '../services/admin.service';
import { ToastService } from '../services/toast.service';
import { Product } from '../models/product';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  loading = false;
  saving = false;
  deleting: number | null = null;
  editingProduct: Product | null = null;
  showForm = false;

  form: FormGroup;
  private destroy$ = new Subject<void>();

  readonly categories = [
    'Electronics', 'Books', 'Sports', 'Home', 'Wearables',
    'Audio', 'Cameras', 'Fitness', 'Kitchen', 'Outdoors',
    'Accessories', 'Toys', 'Personal Care'
  ];

  constructor(
    private adminService: AdminService,
    private toastService: ToastService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      title:       ['', [Validators.required, Validators.minLength(3)]],
      category:    ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(10)]],
      price:       [null, [Validators.required, Validators.min(0.01)]],
      imageUrl:    ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      inStock:     [true, Validators.required],
      stockCount:  [null, [Validators.min(0)]],
      rating:      [null, [Validators.min(0), Validators.max(5)]],
      ratingCount: [null, [Validators.min(0)]],
      review:      ['']
    });
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get totalProducts(): number {
    return this.products.length;
  }

  get inStockProducts(): number {
    return this.products.filter((product) => product.inStock).length;
  }

  get lowStockProducts(): number {
    return this.products.filter((product) => {
      const stockCount = this.getStockCount(product);
      return product.inStock && stockCount > 0 && stockCount <= 2;
    }).length;
  }

  get uniqueCategories(): number {
    return new Set(this.products.map((product) => product.category).filter(Boolean)).size;
  }

  get averagePrice(): number {
    if (!this.products.length) {
      return 0;
    }

    const total = this.products.reduce((sum, product) => sum + product.price, 0);
    return total / this.products.length;
  }

  get catalogValue(): number {
    return this.products.reduce(
      (sum, product) => sum + product.price * this.getStockCount(product),
      0
    );
  }

  loadProducts(): void {
    this.loading = true;
    this.adminService.getProducts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.products = products;
          this.loading = false;
        },
        error: () => {
          this.toastService.show('Failed to load products.');
          this.loading = false;
        }
      });
  }

  openAddForm(): void {
    this.editingProduct = null;
    this.form.reset({ inStock: true });
    this.showForm = true;
  }

  openEditForm(product: Product): void {
    this.editingProduct = product;
    this.form.patchValue(product);
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingProduct = null;
    this.form.reset({ inStock: true });
  }

  saveProduct(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const value = this.form.value;

    const request$ = this.editingProduct
      ? this.adminService.updateProduct(this.editingProduct.id, value)
      : this.adminService.createProduct(value);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toastService.show(
          this.editingProduct ? `"${value.title}" updated.` : `"${value.title}" added.`
        );
        this.saving = false;
        this.cancelForm();
        this.loadProducts();
      },
      error: () => {
        this.toastService.show('Save failed. Please try again.');
        this.saving = false;
      }
    });
  }

  deleteProduct(product: Product): void {
    if (!confirm(`Delete "${product.title}"? This cannot be undone.`)) return;

    this.deleting = product.id;
    this.adminService.deleteProduct(product.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.show(`"${product.title}" deleted.`);
          this.products = this.products.filter(p => p.id !== product.id);
          this.deleting = null;
        },
        error: () => {
          this.toastService.show('Delete failed. Please try again.');
          this.deleting = null;
        }
      });
  }

  get f() { return this.form.controls; }

  fieldError(field: string): string | null {
    const ctrl = this.form.get(field);
    if (!ctrl || !ctrl.invalid || !ctrl.touched) return null;
    if (ctrl.errors?.['required']) return 'This field is required.';
    if (ctrl.errors?.['minlength']) return `Minimum ${ctrl.errors['minlength'].requiredLength} characters.`;
    if (ctrl.errors?.['min']) return `Must be at least ${ctrl.errors['min'].min}.`;
    if (ctrl.errors?.['max']) return `Must be at most ${ctrl.errors['max'].max}.`;
    if (ctrl.errors?.['pattern']) return 'Must be a valid URL starting with http(s)://.';
    return 'Invalid value.';
  }

  private getStockCount(product: Product): number {
    return Math.max(0, Math.floor(product.stockCount ?? 0));
  }
}
