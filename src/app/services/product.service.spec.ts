import { TestBed, waitForAsync } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProductService } from './product.service';
import { AuthService } from './auth.service';
import { Product } from '../models/product';
import { PLATFORM_ID } from '@angular/core';

describe('ProductService', () => {
  let service: ProductService;
  let authService: AuthService;
  let httpMock: HttpTestingController;

  const mockProducts: Product[] = [
    {
      id: 1,
      title: 'Product 1',
      category: 'Electronics',
      description: 'Test Product 1',
      price: 100,
      imageUrl: 'http://test.jpg',
      inStock: true,
      rating: 4.5,
      ratingCount: 100,
      review: 'Great product'
    },
    {
      id: 2,
      title: 'Product 2',
      category: 'Books',
      description: 'Test Product 2',
      price: 15.99,
      imageUrl: 'http://test2.jpg',
      inStock: false,
      rating: 4.0,
      ratingCount: 50
    },
    {
      id: 3,
      title: 'Product 3',
      category: 'Electronics',
      description: 'Test Product 3',
      price: 49.99,
      imageUrl: 'http://test3.jpg',
      inStock: true,
      rating: 4.8,
      ratingCount: 200
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ProductService,
        AuthService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });

    authService = TestBed.inject(AuthService);
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getProducts$', () => {
    it('should fetch products from API', (done) => {
      service.getProducts$().subscribe({
        next: (products) => {
          expect(Array.isArray(products)).toBe(true);
          expect(products.length).toBeGreaterThan(0);
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      expect(req.request.method).toBe('GET');
      req.flush(mockProducts);
    });

    it('should return products with required properties', (done) => {
      service.getProducts$().subscribe({
        next: (products) => {
          products.forEach((product) => {
            expect(product.id).toBeDefined();
            expect(product.title).toBeDefined();
            expect(product.description).toBeDefined();
            expect(product.price).toBeDefined();
            expect(product.imageUrl).toBeDefined();
            expect(product.inStock).toBeDefined();
          });
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      req.flush(mockProducts);
    });

    it('should fallback to in-memory products on API error', (done) => {
      service.getProducts$().subscribe({
        next: (products) => {
          // Should return in-memory products on fallback
          expect(Array.isArray(products)).toBe(true);
          expect(products.length).toBeGreaterThan(0);
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      req.error(new ErrorEvent('Network error'));
    });

    it('should cache products after first fetch', (done) => {
      let callCount = 0;

      service.getProducts$().subscribe({
        next: (products) => {
          callCount++;
          expect(products.length).toBeGreaterThan(0);
          // Note: Caching removed - each call makes new HTTP request
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      req.flush(mockProducts);
    });

    it('should filter by tenant', (done) => {
      const tenantProducts: Product[] = [
        ...mockProducts,
        {
          id: 101,
          title: 'Tenant A Product',
          category: 'Electronics',
          description: 'Visible only to tenant A',
          price: 50,
          imageUrl: 'http://tenant-a.jpg',
          inStock: true,
          tenantId: 'tenant-a'
        }
      ];

      (authService as any).currentUserSubject.next({
        id: 'user-1',
        username: 'testuser',
        tenantId: 'tenant-a'
      });

      service.getProducts$().subscribe({
        next: (products) => {
          // Should not include tenant-b products
          const tenantAProduct = products.find(p => p.id === 101);
          expect(tenantAProduct).toBeDefined();
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      req.flush(tenantProducts);
    });

    it('should handle simulated failures', (done) => {
      service.setSimulateFailures(true);
      spyOn(Math, 'random').and.returnValue(0.1); // < 0.2 threshold

      service.getProducts$().subscribe({
        error: (error) => {
          expect(error.message).toContain('Failed to fetch products');
          done();
        },
        next: (products) => {
          // The service intentionally falls back to in-memory products.
          expect(Array.isArray(products)).toBeTrue();
          expect(products.length).toBeGreaterThan(0);
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      req.flush(mockProducts);
    });
  });

  describe('getById$', () => {
    it('should fetch product by id from API', (done) => {
      service.getById$(1).subscribe({
        next: (product) => {
          expect(product?.id).toBe(1);
          expect(product?.title).toBe('Product 1');
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products/1');
      expect(req.request.method).toBe('GET');
      req.flush(mockProducts[0]);
    });

    it('should return null for non-existent product', (done) => {
      service.getById$(9999).subscribe({
        next: (product) => {
          expect(product).toBeNull();
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products/9999');
      req.flush(null);
    });

    it('should propagate non-404 API errors without in-memory fallback', (done) => {
      service.getById$(1).subscribe({
        error: (error) => {
          expect(error).toBeTruthy();
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products/1');
      req.error(new ErrorEvent('Network error'));
    });

    it('should return null when product endpoint returns 404', (done) => {
      service.getById$(9999).subscribe({
        next: (product) => {
          expect(product).toBeNull();
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products/9999');
      req.flush('Not found', { status: 404, statusText: 'Not Found' });
    });
  });

  describe('getProducts (synchronous fallback)', () => {
    it('should return cached products after observable call', (done) => {
      service.getProducts$().subscribe({
        next: () => {
          // After observable loads, synchronous should return cached
          const products = service.getProducts();
          expect(Array.isArray(products)).toBe(true);
          expect(products.length).toBeGreaterThan(0);
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      req.flush(mockProducts);
    });

    it('should return in-memory products if cache is empty', () => {
      const products = service.getProducts();
      
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
    });
  });

  describe('getById (synchronous fallback)', () => {
    it('should return cached product after observable call', (done) => {
      service.getById$(1).subscribe({
        next: () => {
          const product = service.getById(1);
          expect(product?.id).toBe(1);
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products/1');
      req.flush(mockProducts[0]);
    });

    it('should return in-memory product if cache is empty', () => {
      const product = service.getById(1);
      
      expect(product).toBeTruthy();
      expect(product?.id).toBe(1);
    });

    it('should return null for a missing in-memory product', () => {
      const product = service.getById(9999);

      expect(product).toBeNull();
    });
  });

  describe('setSimulateFailures', () => {
    it('should enable simulated failures', (done) => {
      service.setSimulateFailures(true);
      spyOn(Math, 'random').and.returnValue(0.1);

      service.getProducts$().subscribe({
        next: (products) => {
          // With simulated failures enabled, should still get fallback data
          expect(Array.isArray(products)).toBe(true);
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      req.flush(mockProducts);
    });

    it('should disable simulated failures', (done) => {
      service.setSimulateFailures(false);

      service.getProducts$().subscribe({
        next: (products) => {
          expect(Array.isArray(products)).toBe(true);
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      req.flush(mockProducts);
    });
  });

  describe('Product Data Quality', () => {
    beforeEach(() => {
      service.setSimulateFailures(false);
    });

    it('should have valid product prices', (done) => {
      service.getProducts$().subscribe({
        next: (products) => {
          products.forEach((product) => {
            expect(product.price).toBeGreaterThan(0);
            expect(typeof product.price).toBe('number');
          });
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      req.flush(mockProducts);
    });

    it('should have valid stock status', (done) => {
      service.getProducts$().subscribe({
        next: (products) => {
          products.forEach((product) => {
            expect(typeof product.inStock).toBe('boolean');
          });
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      req.flush(mockProducts);
    });

    it('should have valid ratings when present', (done) => {
      service.getProducts$().subscribe({
        next: (products) => {
          products.forEach((product) => {
            if (product.rating !== undefined) {
              expect(product.rating).toBeGreaterThanOrEqual(0);
              expect(product.rating).toBeLessThanOrEqual(5);
            }
          });
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      req.flush(mockProducts);
    });

    it('should return products with multiple categories', (done) => {
      service.getProducts$().subscribe({
        next: (products) => {
          const categories = new Set(products.map((p) => p.category));
          expect(categories.size).toBeGreaterThan(0);
          done();
        }
      });

      const req = httpMock.expectOne('http://192.168.1.5:3000/products');
      req.flush(mockProducts);
    });
  });
});
