import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminComponent } from './admin.component';
import { AdminService } from '../services/admin.service';
import { InventoryAnalyticsService } from '../services/inventory-analytics.service';
import { ToastService } from '../services/toast.service';
import { Product } from '../models/product';

const mockProduct: Product = {
  id: 1,
  title: 'Test Product',
  category: 'Electronics',
  description: 'A test product description that is long enough',
  price: 29.99,
  imageUrl: 'https://example.com/image.jpg',
  inStock: true,
  stockCount: 10,
  rating: 4.5,
  ratingCount: 100
};

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;
  let adminService: jasmine.SpyObj<AdminService>;
  let inventoryAnalyticsService: InventoryAnalyticsService;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    adminService = jasmine.createSpyObj('AdminService', [
      'getProducts', 'createProduct', 'updateProduct', 'deleteProduct'
    ]);
    toastService = jasmine.createSpyObj('ToastService', ['show']);

    adminService.getProducts.and.returnValue(of([mockProduct]));

    await TestBed.configureTestingModule({
      imports: [AdminComponent, CommonModule, ReactiveFormsModule],
      providers: [
        provideRouter([]),
        { provide: AdminService, useValue: adminService },
        { provide: ToastService, useValue: toastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    inventoryAnalyticsService = TestBed.inject(InventoryAnalyticsService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load products on init', fakeAsync(() => {
    tick();
    expect(adminService.getProducts).toHaveBeenCalled();
    expect(component.products.length).toBe(1);
    expect(component.products[0].title).toBe('Test Product');
  }));

  it('should calculate admin stats from loaded products', fakeAsync(() => {
    adminService.getProducts.and.returnValue(of([
      mockProduct,
      { ...mockProduct, id: 2, inStock: false, stockCount: 0, price: 10, category: 'Books' },
      { ...mockProduct, id: 3, stockCount: 2, price: 60, category: 'Electronics' },
    ]));

    component.loadProducts();
    tick();

    expect(component.totalProducts).toBe(3);
    expect(component.inStockProducts).toBe(2);
    expect(component.lowStockProducts).toBe(1);
    expect(component.uniqueCategories).toBe(2);
    expect(component.averagePrice).toBeCloseTo(33.33, 1);
    expect(component.catalogValue).toBeCloseTo(419.9, 1);
  }));

  it('should count low stock products when stockCount is nullish', () => {
    component.products = [
      { ...mockProduct, id: 2, inStock: true, stockCount: null as unknown as number },
      { ...mockProduct, id: 3, inStock: true, stockCount: 2 },
    ];

    expect(component.lowStockProducts).toBe(1);
  });

  it('should count a concrete low stock product', () => {
    component.products = [
      { ...mockProduct, id: 2, inStock: true, stockCount: 1 },
    ];

    expect(component.lowStockProducts).toBe(1);
  });

  it('should calculate empty and missing-stock admin stats', () => {
    component.products = [];
    expect(component.averagePrice).toBe(0);
    expect(component.catalogValue).toBe(0);
    expect(component.lowStockProducts).toBe(0);

    component.products = [
      { ...mockProduct, id: 2, inStock: true, stockCount: undefined },
      { ...mockProduct, id: 3, inStock: true, stockCount: 2 },
      { ...mockProduct, id: 4, inStock: true, stockCount: 0 },
    ];

    expect(component.lowStockProducts).toBe(1);
    expect(component.catalogValue).toBeCloseTo(59.98, 2);
  });

  it('should provide inventory analytics summary from products', () => {
    component.products = [
      { ...mockProduct, id: 1, stockCount: 10, price: 30, inStock: true },
      { ...mockProduct, id: 2, stockCount: 2, price: 50, inStock: true },
      { ...mockProduct, id: 3, stockCount: 0, price: 90, inStock: false },
    ];

    const analytics = component.inventoryAnalytics;

    expect(analytics.totalUnitsOnHand).toBe(12);
    expect(analytics.outOfStockProducts).toBe(1);
    expect(analytics.atRiskProducts.map((item) => item.id)).toEqual([2]);
    expect(analytics.topInventoryValueProducts[0].id).toBe(1);
  });

  it('should use InventoryAnalyticsService for dashboard calculations', () => {
    const spy = spyOn(inventoryAnalyticsService, 'analyze').and.callThrough();
    component.products = [{ ...mockProduct, id: 9, stockCount: 3 }];

    const analytics = component.inventoryAnalytics;

    expect(spy).toHaveBeenCalledWith(component.products);
    expect(analytics.totalUnitsOnHand).toBe(3);
  });

  it('should show toast when loading fails', fakeAsync(() => {
    adminService.getProducts.and.returnValue(throwError(() => new Error('Network error')));
    component.loadProducts();
    tick();
    expect(toastService.show).toHaveBeenCalledWith('Failed to load products.');
  }));

  it('should open add form with empty state', () => {
    component.openAddForm();
    expect(component.showForm).toBeTrue();
    expect(component.editingProduct).toBeNull();
    expect(component.form.value.title).toBeFalsy();
  });

  it('should open edit form pre-filled with product data', () => {
    component.openEditForm(mockProduct);
    expect(component.showForm).toBeTrue();
    expect(component.editingProduct).toEqual(mockProduct);
    expect(component.form.value.title).toBe('Test Product');
    expect(component.form.value.price).toBe(29.99);
  });

  it('should cancel form and reset state', () => {
    component.openEditForm(mockProduct);
    component.cancelForm();
    expect(component.showForm).toBeFalse();
    expect(component.editingProduct).toBeNull();
  });

  it('should mark form touched and not submit when invalid', () => {
    component.openAddForm();
    component.form.reset();
    component.saveProduct();
    expect(component.form.touched).toBeTrue();
    expect(adminService.createProduct).not.toHaveBeenCalled();
  });

  it('should call createProduct when adding a new product', fakeAsync(() => {
    adminService.createProduct.and.returnValue(of(mockProduct));
    component.openAddForm();
    component.form.setValue({
      title: 'New Product',
      category: 'Books',
      description: 'A sufficiently long description for testing',
      price: 19.99,
      imageUrl: 'https://example.com/new.jpg',
      inStock: true,
      stockCount: 5,
      rating: 4.0,
      ratingCount: 50,
      review: 'Great!'
    });
    component.saveProduct();
    tick();
    expect(adminService.createProduct).toHaveBeenCalled();
    expect(toastService.show).toHaveBeenCalledWith('"New Product" added.');
  }));

  it('should call updateProduct when editing an existing product', fakeAsync(() => {
    adminService.updateProduct.and.returnValue(of(mockProduct));
    component.openEditForm(mockProduct);
    component.form.patchValue({ title: 'Updated Product' });
    component.saveProduct();
    tick();
    expect(adminService.updateProduct).toHaveBeenCalledWith(1, jasmine.any(Object));
    expect(toastService.show).toHaveBeenCalledWith('"Updated Product" updated.');
  }));

  it('should show toast when save fails', fakeAsync(() => {
    adminService.createProduct.and.returnValue(throwError(() => new Error('Save failed')));
    component.openAddForm();
    component.form.setValue({
      title: 'New Product',
      category: 'Books',
      description: 'A sufficiently long description for testing',
      price: 19.99,
      imageUrl: 'https://example.com/new.jpg',
      inStock: true,
      stockCount: 5,
      rating: 4.0,
      ratingCount: 50,
      review: ''
    });
    component.saveProduct();
    tick();
    expect(toastService.show).toHaveBeenCalledWith('Save failed. Please try again.');
  }));

  it('should delete product and remove from list', fakeAsync(() => {
    spyOn(window, 'confirm').and.returnValue(true);
    adminService.deleteProduct.and.returnValue(of(undefined));
    component.products = [mockProduct];
    component.deleteProduct(mockProduct);
    tick();
    expect(adminService.deleteProduct).toHaveBeenCalledWith(1);
    expect(component.products.length).toBe(0);
    expect(toastService.show).toHaveBeenCalledWith('"Test Product" deleted.');
  }));

  it('should not delete when user cancels confirm', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    component.deleteProduct(mockProduct);
    expect(adminService.deleteProduct).not.toHaveBeenCalled();
  });

  it('should show toast when delete fails', fakeAsync(() => {
    spyOn(window, 'confirm').and.returnValue(true);
    adminService.deleteProduct.and.returnValue(throwError(() => new Error('Delete failed')));
    component.deleteProduct(mockProduct);
    tick();
    expect(toastService.show).toHaveBeenCalledWith('Delete failed. Please try again.');
  }));

  it('fieldError() should return null for valid untouched field', () => {
    component.form.get('title')?.setValue('Valid Title');
    expect(component.fieldError('title')).toBeNull();
  });

  it('fieldError() should return required message for empty touched field', () => {
    const ctrl = component.form.get('title')!;
    ctrl.setValue('');
    ctrl.markAsTouched();
    expect(component.fieldError('title')).toBe('This field is required.');
  });

  it('fieldError() should return minlength, min, max, and pattern messages', () => {
    const title = component.form.get('title')!;
    title.setValue('ab');
    title.markAsTouched();
    expect(component.fieldError('title')).toBe('Minimum 3 characters.');

    const price = component.form.get('price')!;
    price.setValue(0);
    price.markAsTouched();
    expect(component.fieldError('price')).toBe('Must be at least 0.01.');

    const rating = component.form.get('rating')!;
    rating.setValue(6);
    rating.markAsTouched();
    expect(component.fieldError('rating')).toBe('Must be at most 5.');

    const imageUrl = component.form.get('imageUrl')!;
    imageUrl.setValue('ftp://example.com/image.jpg');
    imageUrl.markAsTouched();
    expect(component.fieldError('imageUrl')).toBe('Must be a valid URL starting with http(s)://.');
  });

  it('fieldError() should return a generic invalid value message for unknown errors', () => {
    const control = component.form.get('review')!;
    control.setErrors({ custom: true });
    control.markAsTouched();

    expect(component.fieldError('review')).toBe('Invalid value.');
  });

  it('should expose controls through f getter', () => {
    expect(component.f['title']).toBeTruthy();
  });
});
