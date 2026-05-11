import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CheckoutService } from './checkout.service';
import { AppStateService } from './app-state.service';
import { CheckoutError, CheckoutRequest } from '../models/checkout';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let appState: jasmine.SpyObj<AppStateService>;
  let httpMock: HttpTestingController;

  const validRequest: CheckoutRequest = {
    items: [
      {
        id: 1,
        title: 'Test Product',
        description: 'Test',
        price: 29.99,
        imageUrl: 'http://image.test',
        inStock: true,
      },
    ],
    total: 29.99,
    shipping: {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    },
    payment: {
      method: 'card',
      cardLast4: '4242',
    },
  };

  beforeEach(() => {
    appState = jasmine.createSpyObj<AppStateService>('AppStateService', [], {
      simulateFailuresValue: false,
      simulatedCheckoutFailureModeValue: 'none',
    });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CheckoutService, { provide: AppStateService, useValue: appState }],
    });

    service = TestBed.inject(CheckoutService);
    httpMock = TestBed.inject(HttpTestingController);
    spyOn<any>(service, 'simulateNetworkLatency').and.resolveTo();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should throw for empty cart checkout attempts', async () => {
    await expectAsync(
      service.placeOrder({ ...validRequest, items: [] })
    ).toBeRejectedWithError('Your cart is empty. Add items before checking out.');
  });

  it('should return confirmation for valid checkout requests', async () => {
    const orderPromise = service.placeOrder(validRequest);
    await Promise.resolve();

    const getReq = httpMock.expectOne('http://192.168.1.5:3000/products/1');
    expect(getReq.request.method).toBe('GET');
    getReq.flush({ ...validRequest.items[0], stockCount: 3, inStock: true });
    await Promise.resolve();
    await Promise.resolve();

    const putReq = httpMock.expectOne(
      (req) => req.url === 'http://192.168.1.5:3000/products/1' && req.method === 'PUT'
    );
    expect(putReq.request.body.stockCount).toBe(2);
    expect(putReq.request.body.inStock).toBeTrue();
    putReq.flush({ ...validRequest.items[0], stockCount: 2, inStock: true });

    const result = await orderPromise;

    expect(result.orderId).toContain('ORD-');
    expect(result.total).toBe(validRequest.total);
    expect(result.itemCount).toBe(1);
    expect(result.etaDays).toBe(3);
  });

  it('should fail when deterministic checkout-unavailable mode is active', async () => {
    Object.defineProperty(appState, 'simulateFailuresValue', {
      configurable: true,
      get: () => true,
    });

    await expectAsync(service.placeOrder(validRequest)).toBeRejectedWith(
      jasmine.objectContaining({
        failure: jasmine.objectContaining({
          reason: 'CHECKOUT_UNAVAILABLE',
          message: 'Checkout is temporarily unavailable. Please try again.',
        }),
      }) as unknown as CheckoutError
    );
  });

  it('should fail with insufficient stock when deterministic stock-changed mode is active', async () => {
    Object.defineProperty(appState, 'simulatedCheckoutFailureModeValue', {
      configurable: true,
      get: () => 'stock-changed',
    });

    await expectAsync(service.placeOrder(validRequest)).toBeRejectedWith(
      jasmine.objectContaining({
        failure: jasmine.objectContaining({
          reason: 'INSUFFICIENT_STOCK',
          productId: 1,
        }),
      }) as unknown as CheckoutError
    );
  });

  it('should fail with insufficient stock when server stock is lower than requested', async () => {
    const request: CheckoutRequest = {
      ...validRequest,
      items: [{ ...validRequest.items[0] }, { ...validRequest.items[0] }],
      total: 59.98,
    };

    const orderPromise = service.placeOrder(request);
    await Promise.resolve();
    const getReq = httpMock.expectOne('http://192.168.1.5:3000/products/1');
    getReq.flush({ ...validRequest.items[0], stockCount: 1, inStock: true });

    await expectAsync(orderPromise).toBeRejectedWith(
      jasmine.objectContaining({
        failure: jasmine.objectContaining({
          reason: 'INSUFFICIENT_STOCK',
          requestedQuantity: 2,
          availableQuantity: 1,
        }),
      }) as unknown as CheckoutError
    );
  });

  it('should fail with product not found when product no longer exists', async () => {
    const orderPromise = service.placeOrder(validRequest);
    await Promise.resolve();
    const getReq = httpMock.expectOne('http://192.168.1.5:3000/products/1');
    getReq.flush('Not found', { status: 404, statusText: 'Not Found' });

    await expectAsync(orderPromise).toBeRejectedWith(
      jasmine.objectContaining({
        failure: jasmine.objectContaining({
          reason: 'PRODUCT_NOT_FOUND',
          productId: 1,
        }),
      }) as unknown as CheckoutError
    );
  });
});
