import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReservationService } from './reservation.service';
import { Product } from '../models/product';

describe('ReservationService', () => {
  let service: ReservationService;
  let http: HttpTestingController;

  const mockProduct = (id: number, stockCount: number): Product => ({
    id,
    title: `Product ${id}`,
    description: `Description for Product ${id}`,
    price: 10 + id,
    imageUrl: `http://image.test/product${id}.jpg`,
    stockCount,
    inStock: stockCount > 0,
    tenantId: 'tenant-a',
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ReservationService],
    });
    service = TestBed.inject(ReservationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('validateAndReserve', () => {
    it('should create a reservation when stock is available', async () => {
      const items = [{ productId: 1, title: 'Test Product', quantity: 2 }];

      const promise = service.validateAndReserve(items);

      const req = http.expectOne('http://192.168.1.5:3000/products/1');
      expect(req.request.method).toBe('GET');
      req.flush(mockProduct(1, 10));

      const reservationId = await promise;

      expect(reservationId).toMatch(/^RES-\d+-[a-z0-9]+$/);

      const reservation = service.getReservation(reservationId);
      expect(reservation).toBeDefined();
      expect(reservation!.status).toBe('active');
      expect(reservation!.items.size).toBe(1);
    });

    it('should reserve multiple items in a single reservation', async () => {
      const items = [
        { productId: 1, title: 'Product 1', quantity: 2 },
        { productId: 2, title: 'Product 2', quantity: 3 },
      ];

      const promise = service.validateAndReserve(items);

      const req1 = http.expectOne('http://192.168.1.5:3000/products/1');
      req1.flush(mockProduct(1, 10));

      const req2 = http.expectOne('http://192.168.1.5:3000/products/2');
      req2.flush(mockProduct(2, 20));

      const reservationId = await promise;
      const reservation = service.getReservation(reservationId);

      expect(reservation!.items.size).toBe(2);
      expect(reservation!.items.get(1)).toEqual({
        title: 'Product 1',
        originalStock: 10,
        requestedQuantity: 2,
      });
      expect(reservation!.items.get(2)).toEqual({
        title: 'Product 2',
        originalStock: 20,
        requestedQuantity: 3,
      });
    });

    it('should fail if product not found (404)', async () => {
      const items = [{ productId: 999, title: 'Missing Product', quantity: 1 }];

      const promise = service.validateAndReserve(items);

      const req = http.expectOne('http://192.168.1.5:3000/products/999');
      req.flush({ error: 'Not found' }, { status: 404, statusText: 'Not found' });

      await expectAsync(promise).toBeRejectedWithError(/Product not found/);
    });

    it('should fail if insufficient stock', async () => {
      const items = [{ productId: 1, title: 'Low Stock Product', quantity: 20 }];

      const promise = service.validateAndReserve(items);

      const req = http.expectOne('http://192.168.1.5:3000/products/1');
      req.flush(mockProduct(1, 5));

      await expectAsync(promise).toBeRejectedWithError(/Insufficient stock/);
    });

    it('should fail if product is out of stock', async () => {
      const items = [{ productId: 1, title: 'Out of Stock', quantity: 1 }];

      const promise = service.validateAndReserve(items);

      const req = http.expectOne('http://192.168.1.5:3000/products/1');
      req.flush(mockProduct(1, 0));

      await expectAsync(promise).toBeRejectedWithError(/Insufficient stock/);
    });

    it('should clean up reservation on validation failure', async () => {
      const items = [{ productId: 1, title: 'Product', quantity: 100 }];

      const promise = service.validateAndReserve(items);

      const req = http.expectOne('http://192.168.1.5:3000/products/1');
      req.flush(mockProduct(1, 5));

      try {
        await promise;
      } catch {
        // Expected
      }

      // Verify no active reservations remain
      const allReservations = (service as any).activeReservations;
      expect(allReservations.size).toBe(0);
    });
  });

  describe('confirmReservation', () => {
    it('should mark reservation as confirmed when stocks are available', async () => {
      const items = [{ productId: 1, title: 'Product', quantity: 2 }];

      const reservePromise = service.validateAndReserve(items);
      const reserveFetch = http.expectOne('http://192.168.1.5:3000/products/1');
      reserveFetch.flush(mockProduct(1, 10));

      const reservationId = await reservePromise;

      const confirmPromise = service.confirmReservation(reservationId);

      const confirmFetch = http.expectOne({
        method: 'GET',
        url: 'http://192.168.1.5:3000/products/1',
      });
      confirmFetch.flush(mockProduct(1, 10));

      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const updateReq = http.expectOne({
        method: 'PUT',
        url: 'http://192.168.1.5:3000/products/1',
      });
      expect(updateReq.request.body).toEqual(
        jasmine.objectContaining({
          stockCount: 8,
          inStock: true,
        })
      );
      updateReq.flush(mockProduct(1, 8));

      await confirmPromise;

      const reservation = service.getReservation(reservationId);
      expect(reservation?.status).toBe('confirmed');
    });

    it('should fail if reservation does not exist', async () => {
      await expectAsync(service.confirmReservation('RES-invalid')).toBeRejectedWithError(
        /Reservation not found/
      );
    });

    it('should fail if reservation is already cancelled', async () => {
      const items = [{ productId: 1, title: 'Product', quantity: 1 }];

      const reservePromise = service.validateAndReserve(items);

      const req = http.expectOne('http://192.168.1.5:3000/products/1');
      req.flush(mockProduct(1, 10));

      const reservationId = await reservePromise;

      // Cancel it
      service.cancelReservation(reservationId);

      // Try to confirm after a bit (to allow cancelled status to set)
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      await expectAsync(service.confirmReservation(reservationId)).toBeRejected();
    });

    it('should fail if stock changed since reservation', async () => {
      const items = [{ productId: 1, title: 'Product', quantity: 5 }];

      const reservePromise = service.validateAndReserve(items);

      const fetchReq = http.expectOne('http://192.168.1.5:3000/products/1');
      fetchReq.flush(mockProduct(1, 10));

      const reservationId = await reservePromise;

      // Now try to confirm, but stock has dropped
      const confirmPromise = service.confirmReservation(reservationId);

      const refetchReq = http.expectOne('http://192.168.1.5:3000/products/1');
      refetchReq.flush(mockProduct(1, 2)); // Stock dropped below reservation

      await expectAsync(confirmPromise).toBeRejectedWithError(/Stock changed/);
    });
  });

  describe('cancelReservation', () => {
    it('should mark reservation as cancelled', async () => {
      const items = [{ productId: 1, title: 'Product', quantity: 1 }];

      const reservePromise = service.validateAndReserve(items);

      const req = http.expectOne('http://192.168.1.5:3000/products/1');
      req.flush(mockProduct(1, 10));

      const reservationId = await reservePromise;

      service.cancelReservation(reservationId);

      const reservation = service.getReservation(reservationId);
      expect(reservation!.status).toBe('cancelled');
    });

    it('should clean up reservation after delay', async () => {
      const items = [{ productId: 1, title: 'Product', quantity: 1 }];

      const reservePromise = service.validateAndReserve(items);

      const req = http.expectOne('http://192.168.1.5:3000/products/1');
      req.flush(mockProduct(1, 10));

      const reservationId = await reservePromise;

      service.cancelReservation(reservationId);

      // Wait for cleanup timeout
      await new Promise<void>((resolve) => setTimeout(resolve, 1500));

      const reservation = service.getReservation(reservationId);
      expect(reservation).toBeUndefined();
    });

    it('should be idempotent', async () => {
      const items = [{ productId: 1, title: 'Product', quantity: 1 }];

      const reservePromise = service.validateAndReserve(items);

      const req = http.expectOne('http://192.168.1.5:3000/products/1');
      req.flush(mockProduct(1, 10));

      const reservationId = await reservePromise;

      service.cancelReservation(reservationId);
      service.cancelReservation(reservationId);
      service.cancelReservation(reservationId);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('reservation timeout', () => {
    it('should fail to confirm expired reservation', (done) => {
      // This test verifies timeout behavior but we'll use a shorter timeout
      const items = [{ productId: 1, title: 'Product', quantity: 1 }];

      const reservePromise = service.validateAndReserve(items);

      const req = http.expectOne('http://192.168.1.5:3000/products/1');
      req.flush(mockProduct(1, 10));

      reservePromise
        .then((reservationId) => {
          // Manually expire the reservation by manipulating time
          const reservation = (service as any).activeReservations.get(reservationId);
          reservation.expiresAtMs = Date.now() - 1000; // Expired 1 second ago

          return service.confirmReservation(reservationId);
        })
        .then(() => {
          done.fail('Should have thrown');
        })
        .catch((error: Error) => {
          expect(error.message).toContain('Reservation expired');
          done();
        });
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple reservations independently', async () => {
      const items1 = [{ productId: 1, title: 'Product 1', quantity: 2 }];
      const items2 = [{ productId: 2, title: 'Product 2', quantity: 3 }];

      const promise1 = service.validateAndReserve(items1);
      const req1 = http.expectOne('http://192.168.1.5:3000/products/1');
      req1.flush(mockProduct(1, 10));

      const promise2 = service.validateAndReserve(items2);
      const req2 = http.expectOne('http://192.168.1.5:3000/products/2');
      req2.flush(mockProduct(2, 20));

      const [resId1, resId2] = await Promise.all([promise1, promise2]);

      expect(resId1).not.toEqual(resId2);

      const res1 = service.getReservation(resId1);
      const res2 = service.getReservation(resId2);

      expect(res1!.items.get(1)!.requestedQuantity).toBe(2);
      expect(res2!.items.get(2)!.requestedQuantity).toBe(3);
    });
  });
});
