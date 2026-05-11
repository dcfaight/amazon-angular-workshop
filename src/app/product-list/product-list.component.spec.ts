import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductListComponent } from './product-list.component';
import { ProductService } from '../services/product.service';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { AppStateService } from '../services/app-state.service';
import { Product } from '../models/product';
import { PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { User } from '../models/user';
import { environment } from '../../environments/environment';

describe('ProductListComponent', () => {
  let component: ProductListComponent;
  let fixture: ComponentFixture<ProductListComponent>;
  let productService: jasmine.SpyObj<ProductService>;
  let toastService: jasmine.SpyObj<ToastService>;
  let authService: jasmine.SpyObj<AuthService>;
  let currentUser$: BehaviorSubject<User | null>;

  const mockProducts: Product[] = [
    {
      id: 1,
      title: 'Product A',
      category: 'Electronics',
      description: 'Description A',
      price: 100,
      imageUrl: 'http://test.jpg',
      inStock: true,
      rating: 4.5
    },
    {
      id: 2,
      title: 'Product B',
      category: 'Books',
      description: 'Description B',
      price: 50,
      imageUrl: 'http://test2.jpg',
      inStock: true,
      rating: 4.0
    }
  ];

  const mockUser: User = {
    id: 'test-user',
    name: 'Test User',
    tenantId: 'tenant-a',
    roles: ['customer']
  };

  beforeEach(async () => {
    const productServiceSpy = jasmine.createSpyObj('ProductService', [
      'getProducts',
      'getProducts$',
      'getById',
      'getById$',
      'setSimulateFailures'
    ]);
    const toastServiceSpy = jasmine.createSpyObj('ToastService', ['show']);
    currentUser$ = new BehaviorSubject<User | null>(null);
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['signIn', 'signOut'], {
      currentUser$: currentUser$.asObservable()
    });

    productServiceSpy.getProducts.and.returnValue(mockProducts);
    productServiceSpy.getProducts$.and.returnValue(of(mockProducts));

    await TestBed.configureTestingModule({
      imports: [ProductListComponent],
      providers: [
        AppStateService,
        { provide: ProductService, useValue: productServiceSpy },
        { provide: ToastService, useValue: toastServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    }).compileComponents();

    productService = TestBed.inject(ProductService) as jasmine.SpyObj<ProductService>;
    toastService = TestBed.inject(ToastService) as jasmine.SpyObj<ToastService>;
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;

    fixture = TestBed.createComponent(ProductListComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    currentUser$.complete();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty products', () => {
    expect(component.products).toEqual([]);
  });

  it('should initialize with empty search term', () => {
    expect(component.searchTerm).toBe('');
  });

  it('should initialize categories as empty', () => {
    expect(component.categories).toEqual([]);
  });

  describe('filteredProducts', () => {
    beforeEach(() => {
      component.products = mockProducts;
    });

    it('should return all products when no filters applied', () => {
      const filtered = component.filteredProducts;
      expect(filtered.length).toBe(mockProducts.length);
    });

    it('should filter by search term', () => {
      component.searchTerm = 'Product A';
      const filtered = component.filteredProducts;
      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe('Product A');
    });

    it('should filter by category', () => {
      component.selectedCategory = 'Electronics';
      const filtered = component.filteredProducts;
      expect(filtered.every((p) => p.category === 'Electronics')).toBe(true);
    });

    it('should filter by rating', () => {
      component.minRating = 4.2;
      const filtered = component.filteredProducts;
      expect(filtered.every((p) => (p.rating ?? 0) >= 4.2)).toBe(true);
    });

    it('should treat missing rating as zero when filtering by minimum rating', () => {
      component.products = [...mockProducts, {
        id: 3,
        title: 'No Rating Product',
        category: 'Electronics',
        description: 'No rating available',
        price: 10,
        imageUrl: 'http://test3.jpg',
        inStock: true,
      }];
      component.minRating = 1;

      const filtered = component.filteredProducts;

      expect(filtered.some((product) => product.id === 3)).toBe(false);
    });

    it('should sort by price low to high', () => {
      component.sortBy = 'priceLowHigh';
      const filtered = component.filteredProducts;
      for (let i = 0; i < filtered.length - 1; i++) {
        expect(filtered[i].price).toBeLessThanOrEqual(filtered[i + 1].price);
      }
    });

    it('should sort by price high to low', () => {
      component.sortBy = 'priceHighLow';
      const filtered = component.filteredProducts;
      for (let i = 0; i < filtered.length - 1; i++) {
        expect(filtered[i].price).toBeGreaterThanOrEqual(filtered[i + 1].price);
      }
    });

    it('should sort by rating', () => {
      component.sortBy = 'rating';
      const filtered = component.filteredProducts;
      for (let i = 0; i < filtered.length - 1; i++) {
        expect((filtered[i].rating ?? 0)).toBeGreaterThanOrEqual((filtered[i + 1].rating ?? 0));
      }
    });

    it('should sort missing ratings as zero when sorting by rating', () => {
      component.products = [
        {
          id: 3,
          title: 'Mid Rating Product',
          category: 'Electronics',
          description: 'Has a mid rating',
          price: 10,
          imageUrl: 'http://test3.jpg',
          inStock: true,
          rating: 4,
        },
        {
          id: 4,
          title: 'No Rating Product',
          category: 'Electronics',
          description: 'No rating available',
          price: 10,
          imageUrl: 'http://test4.jpg',
          inStock: true,
        },
        {
          id: 5,
          title: 'Top Rating Product',
          category: 'Electronics',
          description: 'Has the top rating',
          price: 10,
          imageUrl: 'http://test5.jpg',
          inStock: true,
          rating: 5,
        }
      ];
      component.sortBy = 'rating';

      const filtered = component.filteredProducts;

      expect(filtered.map((product) => product.id)).toEqual([5, 3, 4]);
    });
  });

  describe('addToCart', () => {
    it('should show toast notification', () => {
      component.addToCart(mockProducts[0]);
      expect(toastService.show).toHaveBeenCalledWith(`Added "${mockProducts[0].title}" to cart!`);
    });

    it('should send instrumentation event', () => {
      spyOn(component, 'sendInstrumentation');
      component.addToCart(mockProducts[0]);
      expect(component.sendInstrumentation).toHaveBeenCalledWith('addToCart', mockProducts[0]);
    });
  });

  describe('stock visibility helpers', () => {
    it('should compute remaining stock from stockCount and cart quantity', () => {
      const product = { ...mockProducts[0], stockCount: 4 };
      (component as any).cartQuantityByProductId = new Map<number, number>([[product.id, 3]]);

      expect(component.getRemainingStock(product)).toBe(1);
    });

    it('should use default stock cap and zero quantity when stock data is missing', () => {
      const product = { ...mockProducts[0], stockCount: undefined as unknown as number };
      (component as any).cartQuantityByProductId = new Map<number, number>();

      expect(component.getRemainingStock(product)).toBe(5);
      expect(component.getStockStateLabel(product)).toBe('In Stock');
      expect(component.getStockStateClass(product)).toBe('stock-state stock-state--in-stock');
    });

    it('should report out of stock when the product is not available', () => {
      const product = { ...mockProducts[0], inStock: false, stockCount: 4 };
      (component as any).cartQuantityByProductId = new Map<number, number>();

      expect(component.getRemainingStock(product)).toBe(0);
      expect(component.getStockState(product)).toBe('out-of-stock');
      expect(component.getStockStateLabel(product)).toBe('Out of Stock');
      expect(component.getStockStateClass(product)).toBe('stock-state stock-state--out-of-stock');
    });

    it('should mark product as low stock when remaining quantity is at threshold', () => {
      const product = { ...mockProducts[0], stockCount: 3 };
      (component as any).cartQuantityByProductId = new Map<number, number>([[product.id, 2]]);

      expect(component.isLowStock(product)).toBeTrue();
    });

    it('should return low-stock state label and class when inventory is low', () => {
      const product = { ...mockProducts[0], stockCount: 3 };
      (component as any).cartQuantityByProductId = new Map<number, number>([[product.id, 2]]);

      expect(component.getStockStateLabel(product)).toBe('Low Stock');
      expect(component.getStockStateClass(product)).toBe('stock-state stock-state--low-stock');
    });
  });

  describe('onSimulatedFailuresChange', () => {
    it('should update product service simulate failures', () => {
      component.simulateFailures = true;
      component.onSimulatedFailuresChange();
      expect(productService.setSimulateFailures).toHaveBeenCalledWith(true);
    });

    it('should reload products', (done) => {
      productService.getProducts$.calls.reset();
      component.onSimulatedFailuresChange();
      
      setTimeout(() => {
        expect(productService.getProducts$).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should show notification when enabled', () => {
      component.simulateFailures = true;
      component.onSimulatedFailuresChange();
      expect(toastService.show).toHaveBeenCalledWith('Simulated backend failures enabled.');
    });

    it('should show notification when disabled', () => {
      component.simulateCheckoutFailureMode = 'stock-changed';
      component.simulateFailures = false;
      component.onSimulatedFailuresChange();
      expect(component.simulateCheckoutFailureMode).toBe('none');
      expect(toastService.show).toHaveBeenCalledWith('Simulated backend failures disabled.');
    });
  });

  describe('onCheckoutFailureModeChange', () => {
    it('should persist selected checkout failure mode and notify', () => {
      const appState = TestBed.inject(AppStateService);
      spyOn(appState, 'setSimulatedCheckoutFailureMode').and.callThrough();
      spyOn(component, 'sendInstrumentation');
      component.simulateCheckoutFailureMode = 'stock-changed';

      component.onCheckoutFailureModeChange();

      expect(appState.setSimulatedCheckoutFailureMode).toHaveBeenCalledWith('stock-changed');
      expect(toastService.show).toHaveBeenCalledWith('Checkout failure mode set to stock-changed.');
      expect(component.sendInstrumentation).toHaveBeenCalledWith('setCheckoutFailureMode', { mode: 'stock-changed' });
    });
  });

  describe('sendInstrumentation', () => {
    it('should not throw error', () => {
      expect(() => {
        component.sendInstrumentation('test', {});
      }).not.toThrow();
    });

    it('should not log when instrumentation is disabled', () => {
      const original = environment.features.enableInstrumentation;
      const logSpy = spyOn(console, 'log');
      environment.features.enableInstrumentation = false;

      component.sendInstrumentation('test', {});

      expect(logSpy).not.toHaveBeenCalled();
      environment.features.enableInstrumentation = original;
    });
  });

  describe('ngOnDestroy', () => {
    it('should handle missing subscription', () => {
      component['authSubscription'] = undefined;
      expect(() => {
        component.ngOnDestroy();
      }).not.toThrow();
    });
  });

  describe('ngOnInit', () => {
    it('should not load products for unauthenticated user', () => {
      fixture.detectChanges();
      expect(component.products).toEqual([]);
    });

    it('should track cart quantities when duplicate cart items are emitted', () => {
      fixture.detectChanges();
      currentUser$.next(mockUser);

      const duplicateProduct = { ...mockProducts[0] };
      const appState = TestBed.inject(AppStateService);
      appState.addToCart(duplicateProduct);
      appState.addToCart(duplicateProduct);

      expect(component.getRemainingStock(duplicateProduct)).toBe(3);
    });

    it('should load products for authenticated user', (done) => {
      fixture.detectChanges();

      currentUser$.next(mockUser);

      // Wait for the async loadProducts to complete
      setTimeout(() => {
        expect(productService.setSimulateFailures).toHaveBeenCalledWith(component.simulateFailures);
        expect(productService.getProducts$).toHaveBeenCalled();
        expect(component.products).toEqual(mockProducts);
        expect(component.categories).toEqual(['Electronics', 'Books']);
        done();
      }, 10);
    });

    it('should clear products and show toast when loading products fails', (done) => {
      fixture.detectChanges();
      productService.getProducts$.and.returnValue(throwError(() => new Error('Backend down')));

      currentUser$.next(mockUser);

      setTimeout(() => {
        expect(toastService.show).toHaveBeenCalledWith('Backend down');
        expect(component.products).toEqual([]);
        expect(component.categories).toEqual([]);
        done();
      }, 10);
    });
  });
});
