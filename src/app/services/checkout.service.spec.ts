import { TestBed } from '@angular/core/testing';
import { CheckoutService } from './checkout.service';
import { ReservationService } from './reservation.service';
import { AppStateService } from './app-state.service';
import { CheckoutRequest, CheckoutError } from '../models/checkout';
import { Product } from '../models/product';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let reservationService: jasmine.SpyObj<ReservationService>;
  let appState: jasmine.SpyObj<AppStateService>;

  const mockProduct = (id: number): Product => ({
    id,
    title: `Product ${id}`,
    description: `Description for Product ${id}`,
    price: 29.99,
    imageUrl: `http://image.test/product${id}.jpg`,
    stockCount: 10,
    inStock: true,
    tenantId: 'tenant-a',
  });

  const validRequest: CheckoutRequest = {
    items: [mockProduct(1)],
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
    reservationService = jasmine.createSpyObj<ReservationService>(
      'ReservationService',
      ['validateAndReserve', 'confirmReservation', 'cancelReservation', 'getReservation']
    );

    appState = jasmine.createSpyObj<AppStateService>('AppStateService', [], {
      simulateFailuresValue: false,
      simulatedCheckoutFailureModeValue: 'none',
    });

    TestBed.configureTestingModule({
      providers: [
        CheckoutService,
        { provide: ReservationService, useValue: reservationService },
        { provide: AppStateService, useValue: appState },
      ],
    });

    service = TestBed.inject(CheckoutService);
    spyOn<any>(service, 'simulateNetworkLatency').and.resolveTo();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('empty cart validation', () => {
    it('should throw for empty cart checkout attempts', async () => {
      await expectAsync(
        service.placeOrder({ ...validRequest, items: [] })
      ).toBeRejectedWithError('Your cart is empty. Add items before checking out.');
    });
  });

  describe('successful checkout with reservation', () => {
    it('should return confirmation when reservation is created and confirmed', async () => {
      reservationService.validateAndReserve.and.resolveTo('RES-123-abc');
      reservationService.confirmReservation.and.resolveTo();

      const result = await service.placeOrder(validRequest);

      expect(result.orderId).toMatch(/^ORD-\d+$/);
      expect(result.total).toBe(validRequest.total);
      expect(result.itemCount).toBe(1);
      expect(result.etaDays).toBe(3);

      expect(reservationService.validateAndReserve).toHaveBeenCalled();
      expect(reservationService.confirmReservation).toHaveBeenCalledWith('RES-123-abc');
      expect(reservationService.cancelReservation).not.toHaveBeenCalled();
    });

    it('should group multiple items of same product for reservation', async () => {
      const multiRequest: CheckoutRequest = {
        ...validRequest,
        items: [mockProduct(1), mockProduct(1), mockProduct(2)],
        total: 89.97,
      };

      reservationService.validateAndReserve.and.resolveTo('RES-123');
      reservationService.confirmReservation.and.resolveTo();

      await service.placeOrder(multiRequest);

      const callArg = reservationService.validateAndReserve.calls.mostRecent().args[0];
      expect(callArg).toEqual(
        jasmine.arrayContaining([
          jasmine.objectContaining({ productId: 1, quantity: 2 }),
          jasmine.objectContaining({ productId: 2, quantity: 1 }),
        ])
      );
    });
  });

  describe('deterministic failure modes', () => {
    it('should fail with checkout-unavailable when mode is checkout-unavailable', async () => {
      Object.defineProperty(appState, 'simulatedCheckoutFailureModeValue', {
        configurable: true,
        get: () => 'checkout-unavailable',
      });

      await expectAsync(service.placeOrder(validRequest)).toBeRejectedWith(
        jasmine.objectContaining({
          failure: jasmine.objectContaining({
            reason: 'CHECKOUT_UNAVAILABLE',
            message: 'Checkout is temporarily unavailable. Please try again.',
          }),
        }) as unknown as CheckoutError
      );

      expect(reservationService.validateAndReserve).not.toHaveBeenCalled();
    });

    it('should fail with insufficient-stock when mode is stock-changed', async () => {
      Object.defineProperty(appState, 'simulatedCheckoutFailureModeValue', {
        configurable: true,
        get: () => 'stock-changed',
      });

      await expectAsync(service.placeOrder(validRequest)).toBeRejectedWith(
        jasmine.objectContaining({
          failure: jasmine.objectContaining({
            reason: 'INSUFFICIENT_STOCK',
            message: jasmine.stringContaining('Stock changed'),
          }),
        }) as unknown as CheckoutError
      );

      expect(reservationService.validateAndReserve).not.toHaveBeenCalled();
    });

    it('should fail with checkout-unavailable when simulate failures is on and mode is none', async () => {
      Object.defineProperty(appState, 'simulateFailuresValue', {
        configurable: true,
        get: () => true,
      });
      Object.defineProperty(appState, 'simulatedCheckoutFailureModeValue', {
        configurable: true,
        get: () => 'none',
      });

      await expectAsync(service.placeOrder(validRequest)).toBeRejectedWith(
        jasmine.objectContaining({
          failure: jasmine.objectContaining({
            reason: 'CHECKOUT_UNAVAILABLE',
          }),
        }) as unknown as CheckoutError
      );

      expect(reservationService.validateAndReserve).not.toHaveBeenCalled();
    });
  });

  describe('reservation failure handling', () => {
    it('should cancel reservation when confirmation fails', async () => {
      reservationService.validateAndReserve.and.resolveTo('RES-123');
      reservationService.confirmReservation.and.rejectWith(
        new Error('Stock changed')
      );

      const error = new Error('Stock changed');
      (error as any).reason = 'STOCK_CHANGED';
      reservationService.confirmReservation.and.rejectWith(error);

      try {
        await service.placeOrder(validRequest);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CheckoutError);
      }

      expect(reservationService.cancelReservation).toHaveBeenCalledWith('RES-123');
    });

    it('should not cancel reservation when validation fails', async () => {
      const validationError = new Error('Product not found');
      (validationError as any).reason = 'PRODUCT_NOT_FOUND';

      reservationService.validateAndReserve.and.rejectWith(validationError);

      try {
        await service.placeOrder(validRequest);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(CheckoutError);
      }

      expect(reservationService.cancelReservation).not.toHaveBeenCalled();
    });

    it('should convert typed reservation errors to CheckoutError', async () => {
      const reservationError = new Error('Insufficient stock');
      (reservationError as any).reason = 'INSUFFICIENT_STOCK';
      (reservationError as any).productId = 1;
      (reservationError as any).requestedQuantity = 10;
      (reservationError as any).availableQuantity = 5;

      reservationService.validateAndReserve.and.rejectWith(reservationError);

      try {
        await service.placeOrder(validRequest);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CheckoutError);
        const checkoutError = error as CheckoutError;
        expect(checkoutError.failure.reason).toBe('INSUFFICIENT_STOCK');
        expect(checkoutError.failure.productId).toBe(1);
        expect(checkoutError.failure.requestedQuantity).toBe(10);
        expect(checkoutError.failure.availableQuantity).toBe(5);
      }
    });

    it('should convert untyped errors to CHECKOUT_UNAVAILABLE', async () => {
      reservationService.validateAndReserve.and.rejectWith(
        new Error('Unknown error')
      );

      try {
        await service.placeOrder(validRequest);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CheckoutError);
        const checkoutError = error as CheckoutError;
        expect(checkoutError.failure.reason).toBe('CHECKOUT_UNAVAILABLE');
        expect(checkoutError.failure.message).toBe('Unknown error');
      }
    });

    it('should handle non-Error types thrown by reservation', async () => {
      reservationService.validateAndReserve.and.rejectWith('string error');

      try {
        await service.placeOrder(validRequest);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CheckoutError);
        const checkoutError = error as CheckoutError;
        expect(checkoutError.failure.reason).toBe('CHECKOUT_UNAVAILABLE');
      }
    });
  });

  describe('checkout line grouping', () => {
    it('should correctly group items with multiple quantities', async () => {
      const multiItemRequest: CheckoutRequest = {
        ...validRequest,
        items: [
          mockProduct(1),
          mockProduct(2),
          mockProduct(1),
          mockProduct(3),
          mockProduct(2),
          mockProduct(1),
        ],
        total: 179.94,
      };

      reservationService.validateAndReserve.and.resolveTo('RES-123');
      reservationService.confirmReservation.and.resolveTo();

      await service.placeOrder(multiItemRequest);

      const callArg = reservationService.validateAndReserve.calls.mostRecent().args[0];
      expect(callArg).toEqual(
        jasmine.arrayContaining([
          jasmine.objectContaining({ productId: 1, quantity: 3 }),
          jasmine.objectContaining({ productId: 2, quantity: 2 }),
          jasmine.objectContaining({ productId: 3, quantity: 1 }),
        ])
      );
      expect(callArg.length).toBe(3);
    });
  });

  describe('order confirmation details', () => {
    it('should set correct item count in confirmation', async () => {
      const multiItemRequest: CheckoutRequest = {
        ...validRequest,
        items: [mockProduct(1), mockProduct(2), mockProduct(1)],
        total: 89.97,
      };

      reservationService.validateAndReserve.and.resolveTo('RES-123');
      reservationService.confirmReservation.and.resolveTo();

      const result = await service.placeOrder(multiItemRequest);

      expect(result.itemCount).toBe(3); // Total items, not grouped count
    });

    it('should set placed timestamp in ISO format', async () => {
      reservationService.validateAndReserve.and.resolveTo('RES-123');
      reservationService.confirmReservation.and.resolveTo();

      const result = await service.placeOrder(validRequest);

      expect(result.placedAtIso).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
      expect(new Date(result.placedAtIso).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should preserve order total from request', async () => {
      const customRequest: CheckoutRequest = {
        ...validRequest,
        total: 123.45,
      };

      reservationService.validateAndReserve.and.resolveTo('RES-123');
      reservationService.confirmReservation.and.resolveTo();

      const result = await service.placeOrder(customRequest);

      expect(result.total).toBe(123.45);
    });
  });
});
