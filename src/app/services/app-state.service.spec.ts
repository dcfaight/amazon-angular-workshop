import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { AppStateService } from './app-state.service';
import { AuthService } from './auth.service';
import { Product } from '../models/product';
import { User } from '../models/user';
import { environment } from '../../environments/environment';

describe('AppStateService', () => {
  let service: AppStateService;
  let authService: AuthService;

  const mockProduct: Product = {
    id: 1,
    title: 'Test Product',
    category: 'Electronics',
    description: 'Test Description',
    price: 99.99,
    imageUrl: 'http://test.jpg',
    inStock: true
  };

  const mockUser: User = {
    id: 'test-user-1',
    name: 'Test User',
    tenantId: 'tenant-a',
    roles: ['customer']
  };

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AppStateService,
        AuthService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });

    authService = TestBed.inject(AuthService);
    service = TestBed.inject(AppStateService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Cart Management', () => {
    it('should initialize with empty cart', (done) => {
      service.cartItems$.subscribe((items) => {
        expect(items).toEqual([]);
        done();
      });
    });

    it('should add product to cart', (done) => {
      let emitCount = 0;
      service.cartItems$.subscribe((items) => {
        emitCount++;
        if (emitCount === 2) {
          expect(items).toContain(mockProduct);
          done();
        }
      });

      service.addToCart(mockProduct);
    });

    it('should add multiple products to cart', (done) => {
      const product2: Product = { ...mockProduct, id: 2, title: 'Product 2' };
      let emitCount = 0;

      service.cartItems$.subscribe((items) => {
        emitCount++;
        if (emitCount === 3) {
          expect(items.length).toBe(2);
          expect(items).toContain(mockProduct);
          expect(items).toContain(product2);
          done();
        }
      });

      service.addToCart(mockProduct);
      service.addToCart(product2);
    });

    it('should persist cart to localStorage', (done) => {
      service.addToCart(mockProduct);
      
      setTimeout(() => {
        const saved = localStorage.getItem('cart:guest');
        expect(saved).toBeTruthy();
        const parsedCart = JSON.parse(saved!) as Product[];
        expect(parsedCart).toContain(mockProduct);
        done();
      }, 10);
    });

    it('should not persist cart to localStorage on the server platform', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AppStateService,
          AuthService,
          { provide: PLATFORM_ID, useValue: 'server' }
        ]
      });

      const serverService = TestBed.inject(AppStateService);
      serverService.addToCart(mockProduct);

      expect(localStorage.getItem('cart:guest')).toBeNull();
    });

    it('should ignore stored failure flag when the toggle is disabled', () => {
      const originalAllowToggle = environment.features.allowSimulatedFailureToggle;
      environment.features.allowSimulatedFailureToggle = false;
      localStorage.setItem('simulateFailures', 'true');

      service.initializeFeatureFlagsFromStorage();

      expect(service.simulateFailuresValue).toBe(environment.features.simulateBackendFailuresDefault);
      environment.features.allowSimulatedFailureToggle = originalAllowToggle;
    });

    it('should clear cart', (done) => {
      service.addToCart(mockProduct);
      
      setTimeout(() => {
        service.clearCart();
        
        setTimeout(() => {
          service.cartItems$.subscribe((items) => {
            expect(items).toEqual([]);
            done();
          });
        }, 10);
      }, 10);
    });

    it('should clear cart from localStorage', (done) => {
      service.addToCart(mockProduct);

      setTimeout(() => {
        service.clearCart();

        setTimeout(() => {
          const saved = localStorage.getItem('cart:guest');
          expect(JSON.parse(saved || '[]')).toEqual([]);
          done();
        }, 10);
      }, 10);
    });

    it('should use user-specific cart key when user is signed in', (done) => {
      authService.signIn({ username: mockUser.id, password: 'pass' });

      setTimeout(() => {
        service.addToCart(mockProduct);

        setTimeout(() => {
          const saved = localStorage.getItem(`cart:${mockUser.id}`);
          expect(saved).toBeTruthy();
          expect(JSON.parse(saved || '[]')).toContain(mockProduct);
          done();
        }, 10);
      }, 10);
    });

    it('should update quantity for a cart item', (done) => {
      service.addToCart(mockProduct);

      setTimeout(() => {
        service.setCartItemQuantity(mockProduct.id, 3);

        setTimeout(() => {
          service.cartItems$.subscribe((items) => {
            const matching = items.filter((item) => item.id === mockProduct.id);
            expect(matching.length).toBe(3);
            done();
          });
        }, 10);
      }, 10);
    });

    it('should remove item when quantity is set to zero', (done) => {
      service.addToCart(mockProduct);

      setTimeout(() => {
        service.setCartItemQuantity(mockProduct.id, 0);

        setTimeout(() => {
          service.cartItems$.subscribe((items) => {
            const matching = items.filter((item) => item.id === mockProduct.id);
            expect(matching.length).toBe(0);
            done();
          });
        }, 10);
      }, 10);
    });

    it('should not add beyond stockCount limit', (done) => {
      const limitedProduct: Product = { ...mockProduct, id: 99, stockCount: 2 };

      service.addToCart(limitedProduct);
      service.addToCart(limitedProduct);
      service.addToCart(limitedProduct);

      setTimeout(() => {
        service.cartItems$.subscribe((items) => {
          const matching = items.filter((item) => item.id === limitedProduct.id);
          expect(matching.length).toBe(2);
          done();
        });
      }, 10);
    });

    it('should not add out-of-stock items', (done) => {
      const unavailableProduct: Product = { ...mockProduct, id: 101, inStock: false };

      service.addToCart(unavailableProduct);

      setTimeout(() => {
        service.cartItems$.subscribe((items) => {
          const matching = items.filter((item) => item.id === unavailableProduct.id);
          expect(matching.length).toBe(0);
          done();
        });
      }, 10);
    });

    it('should cap setCartItemQuantity to stockCount limit', (done) => {
      const limitedProduct: Product = { ...mockProduct, id: 102, stockCount: 2 };
      service.addToCart(limitedProduct);

      setTimeout(() => {
        service.setCartItemQuantity(limitedProduct.id, 5);

        setTimeout(() => {
          service.cartItems$.subscribe((items) => {
            const matching = items.filter((item) => item.id === limitedProduct.id);
            expect(matching.length).toBe(2);
            done();
          });
        }, 10);
      }, 10);
    });

    it('should ignore setCartItemQuantity when the item is not in the cart', () => {
      service.setCartItemQuantity(999, 3);

      expect(service.cartItems$).toBeDefined();
    });
  });

  describe('Cart Count Observable', () => {
    it('should emit correct cart count', (done) => {
      let emitCount = 0;
      service.cartCount$.subscribe((count) => {
        emitCount++;
        if (emitCount === 2) {
          expect(count).toBe(1);
          done();
        }
      });

      service.addToCart(mockProduct);
    });

    it('should update count when multiple items added', (done) => {
      const product2: Product = { ...mockProduct, id: 2 };
      const counts: number[] = [];

      service.cartCount$.subscribe((count) => {
        counts.push(count);
        if (counts.length === 3) {
          expect(counts[0]).toBe(0);
          expect(counts[1]).toBe(1);
          expect(counts[2]).toBe(2);
          done();
        }
      });

      service.addToCart(mockProduct);
      service.addToCart(product2);
    });

    it('should reset count to 0 when cart cleared', (done) => {
      const counts: number[] = [];

      service.cartCount$.subscribe((count) => {
        counts.push(count);
        if (counts.length === 3) {
          expect(counts[2]).toBe(0);
          done();
        }
      });

      service.addToCart(mockProduct);
      service.clearCart();
    });
  });

  describe('Cart Open/Close', () => {
    it('should initialize with cart closed', (done) => {
      service.cartOpen$.subscribe((open) => {
        expect(open).toBe(false);
        done();
      });
    });

    it('should toggle cart open state', (done) => {
      const states: boolean[] = [];

      service.cartOpen$.subscribe((open) => {
        states.push(open);
        if (states.length === 3) {
          expect(states[0]).toBe(false);
          expect(states[1]).toBe(true);
          expect(states[2]).toBe(false);
          done();
        }
      });

      service.toggleCart();
      service.toggleCart();
    });

    it('should set cart open to specific state', (done) => {
      const states: boolean[] = [];

      service.cartOpen$.subscribe((open) => {
        states.push(open);
        if (states.length === 3) {
          expect(states[1]).toBe(true);
          expect(states[2]).toBe(true);
          done();
        }
      });

      service.setCartOpen(true);
      service.setCartOpen(true);
    });

    it('cartOpenValue getter should return current state', () => {
      service.setCartOpen(true);
      expect(service.cartOpenValue).toBe(true);

      service.setCartOpen(false);
      expect(service.cartOpenValue).toBe(false);
    });
  });

  describe('Simulated Failures', () => {
    it('should initialize with default environment value', () => {
      expect(service.simulateFailuresValue).toBeDefined();
    });

    it('should set simulated failures flag', (done) => {
      let emitCount = 0;
      service.simulateFailures$.subscribe((enabled) => {
        emitCount++;
        if (emitCount === 2) {
          expect(enabled).toBe(true);
          done();
        }
      });

      service.setSimulateFailures(true);
    });

    it('should persist simulated failures to localStorage', () => {
      service.setSimulateFailures(true);

      const saved = localStorage.getItem('simulateFailures');
      expect(saved).toBe('true');

      service.setSimulateFailures(false);
      const updated = localStorage.getItem('simulateFailures');
      expect(updated).toBe('false');
    });

    it('simulateFailuresValue getter should return current state', () => {
      service.setSimulateFailures(true);
      expect(service.simulateFailuresValue).toBe(true);

      service.setSimulateFailures(false);
      expect(service.simulateFailuresValue).toBe(false);
    });

    it('should set and persist deterministic checkout failure mode', () => {
      service.setSimulatedCheckoutFailureMode('stock-changed');

      expect(service.simulatedCheckoutFailureModeValue).toBe('stock-changed');
      expect(localStorage.getItem('simulateCheckoutFailureMode')).toBe('stock-changed');
    });

    it('should reset deterministic checkout failure mode when simulate failures is disabled', () => {
      service.setSimulatedCheckoutFailureMode('checkout-unavailable');

      service.setSimulateFailures(false);

      expect(service.simulatedCheckoutFailureModeValue).toBe('none');
      expect(localStorage.getItem('simulateCheckoutFailureMode')).toBe('none');
    });

    it('should restore simulated failures from localStorage', () => {
      const original = environment.features.allowSimulatedFailureToggle;
      environment.features.allowSimulatedFailureToggle = true;
      localStorage.clear();
      localStorage.setItem('simulateFailures', 'true');
      localStorage.setItem('allowSimulatedFailureToggle', 'true');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AppStateService,
          AuthService,
          { provide: PLATFORM_ID, useValue: 'browser' }
        ]
      });
      
      const newService = TestBed.inject(AppStateService);
      expect(newService.simulateFailuresValue).toBe(true);
      environment.features.allowSimulatedFailureToggle = original;
    });

    it('should restore deterministic checkout failure mode from localStorage', () => {
      localStorage.setItem('simulateCheckoutFailureMode', 'stock-changed');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AppStateService,
          AuthService,
          { provide: PLATFORM_ID, useValue: 'browser' }
        ]
      });

      const restoredService = TestBed.inject(AppStateService);
      expect(restoredService.simulatedCheckoutFailureModeValue).toBe('stock-changed');
    });
  });

  describe('Theme Management', () => {
    it('should initialize with light theme', (done) => {
      service.theme$.subscribe((theme) => {
        expect(theme).toBe('light');
        done();
      });
    });

    it('should toggle theme', (done) => {
      const themes: ('light' | 'dark')[] = [];

      service.theme$.subscribe((theme) => {
        themes.push(theme);
        if (themes.length === 3) {
          expect(themes[0]).toBe('light');
          expect(themes[1]).toBe('dark');
          expect(themes[2]).toBe('light');
          done();
        }
      });

      service.toggleTheme();
      service.toggleTheme();
    });

    it('should set theme to specific value', (done) => {
      let emitCount = 0;
      service.theme$.subscribe((theme) => {
        emitCount++;
        if (emitCount === 2) {
          expect(theme).toBe('dark');
          done();
        }
      });

      service.setTheme('dark');
    });

    it('should persist theme to localStorage', () => {
      service.setTheme('dark');

      let saved = localStorage.getItem('theme');
      expect(saved).toBe('dark');

      service.setTheme('light');
      saved = localStorage.getItem('theme');
      expect(saved).toBe('light');
    });

    it('themeValue getter should return current theme', () => {
      service.setTheme('dark');
      expect(service.themeValue).toBe('dark');

      service.setTheme('light');
      expect(service.themeValue).toBe('light');
    });

    it('should restore theme from localStorage', () => {
      localStorage.setItem('theme', 'dark');

      const testBed = TestBed.inject(AppStateService);
      testBed.initializeFeatureFlagsFromStorage();

      expect(testBed.themeValue).toBe('dark');
    });
  });

  describe('Feature Flags Initialization', () => {
    it('should restore feature flags from localStorage', () => {
      localStorage.clear();
      localStorage.setItem('simulateFailures', 'true');
      localStorage.setItem('theme', 'dark');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AppStateService,
          AuthService,
          { provide: PLATFORM_ID, useValue: 'browser' }
        ]
      });
      
      const newService = TestBed.inject(AppStateService);
      expect(newService.simulateFailuresValue).toBe(false);
      expect(newService.themeValue).toBe('dark');
    });

    it('should not throw error on non-browser platform', () => {
      const serverTestBed = TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AppStateService,
          AuthService,
          { provide: PLATFORM_ID, useValue: 'server' }
        ]
      });

      const newService = TestBed.inject(AppStateService);

      expect(() => {
        newService.initializeFeatureFlagsFromStorage();
      }).not.toThrow();

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AppStateService,
          AuthService,
          { provide: PLATFORM_ID, useValue: 'browser' }
        ]
      });
    });

    it('should handle invalid theme values', () => {
      localStorage.setItem('theme', 'invalid-theme');

      const testBed = TestBed.inject(AppStateService);
      testBed.initializeFeatureFlagsFromStorage();

      // Should not change from default light
      expect(testBed.themeValue).toBe('light');
    });
  });

  describe('currentUser$ Observable', () => {
    it('should pass through auth service user stream', (done) => {
      let emitCount = 0;
      service.currentUser$.subscribe((user) => {
        emitCount++;
        if (emitCount === 2) {
          expect(user?.id).toBe(mockUser.id);
          done();
        }
      });

      authService.signIn({ username: mockUser.id, password: 'pass' });
    });
  });

  describe('Cart Hydration on User Change', () => {
    it('should hydrate cart for new user', (done) => {
      // Simulate saved cart for user
      const cartKey = `cart:${mockUser.id}`;
      localStorage.setItem(cartKey, JSON.stringify([mockProduct]));

      let emitCount = 0;
      service.cartItems$.subscribe((items) => {
        emitCount++;
        if (emitCount === 2) {
          expect(items).toContain(mockProduct);
          done();
        }
      });

      authService.signIn({ username: mockUser.id, password: 'pass' });
    });

    it('should clear cart when user logs out', (done) => {
      const cartKey = `cart:${mockUser.id}`;
      localStorage.setItem(cartKey, JSON.stringify([mockProduct]));

      authService.signIn({ username: mockUser.id, password: 'pass' });

      setTimeout(() => {
        authService.signOut();

        setTimeout(() => {
          service.cartItems$.subscribe((items) => {
            expect(items).toEqual([]);
            done();
          });
        }, 10);
      }, 10);
    });
  });
});
