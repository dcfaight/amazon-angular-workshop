import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { ProductService } from '../services/product.service';
import { ToastService } from '../services/toast.service';
import { Product } from '../models/product';
import { AppStateService } from '../services/app-state.service';

import { ProductDetailComponent } from './product-detail.component';

describe('ProductDetailComponent', () => {
  let component: ProductDetailComponent;
  let fixture: ComponentFixture<ProductDetailComponent>;
  let productService: jasmine.SpyObj<ProductService>;
  let toastService: jasmine.SpyObj<ToastService>;
  let appState: jasmine.SpyObj<AppStateService>;
  let location: jasmine.SpyObj<Location>;

  const cartItems$ = new BehaviorSubject<Product[]>([]);

  const mockProduct: Product = {
    id: 1,
    title: 'Test Product',
    category: 'Electronics',
    description: 'Test Description',
    price: 99.99,
    imageUrl: 'http://test.jpg',
    inStock: true,
  };

  beforeEach(async () => {
    productService = jasmine.createSpyObj<ProductService>('ProductService', ['getById', 'getById$']);
    toastService = jasmine.createSpyObj<ToastService>('ToastService', ['show']);
    appState = jasmine.createSpyObj<AppStateService>('AppStateService', ['addToCart'], {
      cartItems$: cartItems$.asObservable(),
    });
    location = jasmine.createSpyObj<Location>('Location', ['back']);
    productService.getById.and.returnValue(mockProduct);
    productService.getById$.and.returnValue(of(mockProduct));

    await TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => '1',
              },
            },
          },
        },
        {
          provide: ProductService,
          useValue: productService,
        },
        {
          provide: ToastService,
          useValue: toastService,
        },
        {
          provide: AppStateService,
          useValue: appState,
        },
        {
          provide: Location,
          useValue: location,
        },
      ],
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ProductDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  beforeEach(() => {
    cartItems$.next([]);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not fetch product when input product is already provided', () => {
    productService.getById.calls.reset();
    component.product = mockProduct;

    component.ngOnInit();

    expect(productService.getById).not.toHaveBeenCalled();
    expect(component.product).toEqual(mockProduct);
  });

  it('should show toast and clear product when product lookup fails', (done) => {
    const error = new Error('Lookup failed');
    productService.getById$.and.returnValue(throwError(() => error));
    component.product = null;

    component.ngOnInit();

    setTimeout(() => {
      expect(toastService.show).toHaveBeenCalledWith('Lookup failed');
      expect(component.product).toBeNull();
      done();
    }, 10);
  });

  it('should clear product when lookup returns no result', (done) => {
    productService.getById$.and.returnValue(of(null));
    component.product = null;

    component.ngOnInit();

    setTimeout(() => {
      expect(component.product).toBeNull();
      expect(component.cartQuantityForProduct).toBe(0);
      expect(toastService.show).not.toHaveBeenCalled();
      done();
    }, 10);
  });

  it('should add product to cart and show a toast', () => {
    component.addToCart(mockProduct);

    expect(appState.addToCart).toHaveBeenCalledWith(mockProduct);
    expect(toastService.show).toHaveBeenCalledWith('Added "Test Product" to cart!');
  });

  it('should disable add-to-cart when max quantity is reached', () => {
    component.product = { ...mockProduct, stockCount: 2 };
    cartItems$.next([mockProduct, mockProduct]);

    expect(component.isAddToCartDisabled(component.product)).toBeTrue();
  });

  it('should disable add-to-cart when the product is out of stock', () => {
    const outOfStockProduct = { ...mockProduct, inStock: false };

    expect(component.isAddToCartDisabled(outOfStockProduct)).toBeTrue();
  });

  it('should compute remaining stock for detail product', () => {
    const stockedProduct = { ...mockProduct, stockCount: 4 };
    component.product = stockedProduct;
    cartItems$.next([mockProduct, mockProduct]);

    expect(component.getRemainingStock(stockedProduct)).toBe(2);
  });

  it('should mark detail product low stock when remaining quantity is low', () => {
    const stockedProduct = { ...mockProduct, stockCount: 3 };
    component.product = stockedProduct;
    cartItems$.next([mockProduct, mockProduct]);

    expect(component.isLowStock(stockedProduct)).toBeTrue();
  });

  it('should return low-stock state label and class when remaining inventory is low', () => {
    const stockedProduct = { ...mockProduct, stockCount: 3 };
    component.product = stockedProduct;
    cartItems$.next([mockProduct, mockProduct]);

    expect(component.getStockState(stockedProduct)).toBe('low-stock');
    expect(component.getStockStateLabel(stockedProduct)).toBe('Low Stock');
    expect(component.getStockStateClass(stockedProduct)).toBe('stock-state stock-state--low-stock');
  });

  it('should return out-of-stock state label and class when no remaining inventory', () => {
    const stockedProduct = { ...mockProduct, stockCount: 2 };
    component.product = stockedProduct;
    cartItems$.next([mockProduct, mockProduct]);

    expect(component.getStockStateLabel(stockedProduct)).toBe('Out of Stock');
    expect(component.getStockStateClass(stockedProduct)).toBe('stock-state stock-state--out-of-stock');
  });

  it('should return in-stock state label and allow adding when inventory remains', () => {
    const stockedProduct = { ...mockProduct, stockCount: 5 };
    component.product = stockedProduct;
    cartItems$.next([mockProduct]);

    expect(component.isAddToCartDisabled(stockedProduct)).toBeFalse();
    expect(component.getStockStateLabel(stockedProduct)).toBe('In Stock');
    expect(component.getStockStateClass(stockedProduct)).toBe('stock-state stock-state--in-stock');
  });

  it('should use the default stock cap when stockCount is missing', () => {
    const defaultStockProduct = { ...mockProduct };
    component.product = defaultStockProduct;
    cartItems$.next([mockProduct]);

    expect(component.getRemainingStock(defaultStockProduct)).toBe(4);
    expect(component.isAddToCartDisabled(defaultStockProduct)).toBeFalse();
  });

  it('should go back when back button action is triggered', () => {
    component.goBack();

    expect(location.back).toHaveBeenCalled();
  });
});
