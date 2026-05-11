import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OrderService } from './order.service';
import { AuthService } from './auth.service';
import { Order } from '../models/order';

describe('OrderService', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;

  const authService = jasmine.createSpyObj<AuthService>('AuthService', [], {
    currentUserValue: {
      id: '1',
      name: 'Alex Smith',
      tenantId: 'north-america',
      roles: ['admin'],
    },
  });

  const mockOrders: Order[] = [
    {
      id: 1,
      orderNumber: 'ORD-100',
      userId: '1',
      userName: 'Alex Smith',
      tenantId: 'north-america',
      createdAt: '2026-05-10T10:00:00.000Z',
      status: 'pending',
      subtotal: 99.99,
      total: 99.99,
      totalItems: 1,
      shippingAddress: {
        fullName: 'Alex Smith',
        addressLine1: '123 Main St',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
      },
      paymentMethod: 'card',
      items: [
        {
          productId: 1,
          title: 'Test Product',
          price: 99.99,
          quantity: 1,
          imageUrl: 'https://example.com/a.jpg',
        },
      ],
    },
    {
      id: 2,
      orderNumber: 'ORD-090',
      userId: '1',
      userName: 'Alex Smith',
      tenantId: 'north-america',
      createdAt: '2026-05-09T10:00:00.000Z',
      status: 'pending',
      subtotal: 49.99,
      total: 49.99,
      totalItems: 1,
      shippingAddress: {
        fullName: 'Alex Smith',
        addressLine1: '123 Main St',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
      },
      paymentMethod: 'paypal',
      items: [],
    },
  ];

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OrderService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthService, useValue: authService },
      ],
    });

    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should fetch current user orders sorted newest first', () => {
    service.getOrdersForCurrentUser().subscribe((orders) => {
      expect(orders.length).toBe(2);
      expect(orders[0].orderNumber).toBe('ORD-100');
      expect(orders[1].orderNumber).toBe('ORD-090');
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders?userId=1');
    expect(req.request.method).toBe('GET');
    req.flush([mockOrders[1], mockOrders[0]]);
  });

  it('should provide seeded orders when backend returns none', () => {
    service.getOrdersForCurrentUser().subscribe((orders) => {
      expect(orders.length).toBe(3);
      expect(orders.every((order) => order.isSeeded)).toBeTrue();
      expect(orders.some((order) => order.status === 'confirmed')).toBeTrue();
      expect(orders.some((order) => order.status === 'shipped')).toBeTrue();
      expect(orders.some((order) => order.status === 'pending')).toBeTrue();
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders?userId=1');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should normalize legacy orders with missing fields', () => {
    service.getOrdersForCurrentUser().subscribe((orders) => {
      expect(orders).toHaveSize(1);
      expect(orders[0].orderNumber).toMatch(/^ORD-/);
      expect(orders[0].id).toContain('legacy-1-');
      expect(orders[0].userName).toBe('Alex Smith');
      expect(orders[0].tenantId).toBe('north-america');
      expect(orders[0].status).toBe('pending');
      expect(orders[0].paymentMethod).toBe('card');
      expect(orders[0].shippingAddress.addressLine1).toContain('legacy order');
      expect(orders[0].totalItems).toBe(0);
      expect(orders[0].subtotal).toBe(0);
      expect(orders[0].items).toEqual([]);
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders?userId=1');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        userId: '1',
      },
    ]);
  });

  it('should normalize item price from unitPrice and default item image', () => {
    service.getOrdersForCurrentUser().subscribe((orders) => {
      expect(orders).toHaveSize(1);
      expect(orders[0].items[0].price).toBe(7);
      expect(orders[0].items[0].imageUrl).toBe('https://via.placeholder.com/80');
      expect(orders[0].userId).toBe('1');
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders?userId=1');
    req.flush([
      {
        id: '',
        userId: undefined,
        orderNumber: '',
        items: [
          {
            productId: 9,
            title: 'Legacy Adapter',
            unitPrice: 7,
            quantity: 2,
          },
        ],
      },
    ]);
  });

  it('should normalize missing item price to zero', () => {
    service.getOrdersForCurrentUser().subscribe((orders) => {
      expect(orders[0].items[0].price).toBe(0);
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders?userId=1');
    req.flush([
      {
        id: 'legacy-2',
        userId: '1',
        items: [
          {
            productId: 10,
            title: 'No Price Item',
            quantity: 1,
          },
        ],
      },
    ]);
  });

  it('should merge local orders with backend orders and keep newest first', () => {
    localStorage.setItem(
      'orders:1',
      JSON.stringify([
        {
          id: 'local-order',
          orderNumber: 'ORD-LOCAL-1',
          userId: '1',
          userName: 'Alex Smith',
          tenantId: 'north-america',
          createdAt: '2026-05-10T12:00:00.000Z',
          status: 'confirmed',
          subtotal: 10,
          total: 10,
          totalItems: 1,
          shippingAddress: {
            fullName: 'Alex Smith',
            addressLine1: '1 Test Way',
            city: 'Seattle',
            state: 'WA',
            zip: '98101',
          },
          paymentMethod: 'card',
          items: [],
        },
      ])
    );

    service.getOrdersForCurrentUser().subscribe((orders) => {
      expect(orders.length).toBe(2);
      expect(orders[0].orderNumber).toBe('ORD-LOCAL-1');
      expect(orders[1].orderNumber).toBe('ORD-100');
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders?userId=1');
    req.flush([mockOrders[0]]);
  });

  it('should return empty array when no current user exists', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OrderService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthService, useValue: jasmine.createSpyObj<AuthService>('AuthService', [], { currentUserValue: null }) },
      ],
    });

    const localService = TestBed.inject(OrderService);
    const localHttpMock = TestBed.inject(HttpTestingController);

    localService.getOrdersForCurrentUser().subscribe((orders) => {
      expect(orders).toEqual([]);
    });

    localHttpMock.expectNone('http://192.168.1.5:3000/orders?userId=1');
    localHttpMock.verify();
  });

  it('should create an order', () => {
    const { id, ...newOrder } = mockOrders[0];

    service.createOrder(newOrder).subscribe((order) => {
      expect(order.id).toBe(1);
      expect(order.orderNumber).toBe('ORD-100');
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newOrder);
    req.flush(mockOrders[0]);

    const saved = JSON.parse(localStorage.getItem('orders:1') || '[]') as Order[];
    expect(saved.some((order) => order.orderNumber === 'ORD-100')).toBeTrue();
  });

  it('should use the order id as a merge key when order number is blank', () => {
    localStorage.setItem(
      'orders:1',
      JSON.stringify([
        {
          id: 'blank-key',
          orderNumber: '',
          userId: '1',
          userName: 'Alex Smith',
          tenantId: 'north-america',
          createdAt: '2026-05-10T12:30:00.000Z',
          status: 'pending',
          subtotal: 1,
          total: 1,
          totalItems: 1,
          shippingAddress: {
            fullName: 'Alex Smith',
            addressLine1: '1 Test Way',
            city: 'Seattle',
            state: 'WA',
            zip: '98101',
          },
          paymentMethod: 'card',
          items: [],
        },
      ])
    );

    service.getOrdersForCurrentUser().subscribe((orders) => {
      expect(orders.some((order) => order.id === 'blank-key')).toBeTrue();
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders?userId=1');
    req.flush([]);
  });

  it('should fall back to seeded orders when the backend request fails', () => {
    service.getOrdersForCurrentUser().subscribe((orders) => {
      expect(orders.length).toBe(3);
      expect(orders.every((order) => order.isSeeded)).toBeTrue();
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders?userId=1');
    req.error(new ProgressEvent('Network error'));
  });

  it('should save a pending order locally when createOrder fails', () => {
    const { id, ...newOrder } = mockOrders[0];

    service.createOrder(newOrder).subscribe((order) => {
      expect(order.orderNumber).toBe('ORD-100');
      expect(order.id).toContain('local-');
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders');
    expect(req.request.method).toBe('POST');
    req.error(new ProgressEvent('Network error'));

    const saved = JSON.parse(localStorage.getItem('orders:1') || '[]') as Order[];
    expect(saved.some((order) => order.orderNumber === 'ORD-100')).toBeTrue();
  });

  it('should skip duplicate orders when merging local and backend results', () => {
    const user = authService.currentUserValue!;
    const duplicateOrder = { ...mockOrders[0] };

    const merged = (service as never as {
      mergeOrders: (baseOrders: Order[], localOrders: Order[], currentUser: typeof user) => Order[];
    }).mergeOrders([duplicateOrder], [duplicateOrder], user);

    expect(merged).toHaveSize(1);
    expect(merged[0].orderNumber).toBe('ORD-100');
  });

  it('should fall back to empty local orders when stored JSON is invalid', () => {
    localStorage.setItem('orders:1', 'not-json');

    const parsed = (service as never as {
      readLocalOrders: (currentUser: typeof authService.currentUserValue) => Order[];
      readLocalOrdersByUserId: (userId: string) => Order[];
    }).readLocalOrders(authService.currentUserValue!);

    expect(parsed).toEqual([]);
    expect((service as never as { readLocalOrdersByUserId: (userId: string) => Order[] }).readLocalOrdersByUserId('1')).toEqual([]);
  });

  it('should ignore local storage helpers on the server platform', () => {
    const serverService = new OrderService('server' as never, {} as never, authService);

    expect((serverService as never as { readLocalOrders: (currentUser: typeof authService.currentUserValue) => Order[] }).readLocalOrders(authService.currentUserValue!)).toEqual([]);
    expect((serverService as never as { readLocalOrdersByUserId: (userId: string) => Order[] }).readLocalOrdersByUserId('1')).toEqual([]);

    expect(() => (serverService as never as { saveLocalOrder: (order: Order) => void }).saveLocalOrder(mockOrders[0])).not.toThrow();
  });

  it('should replace an existing local order with the same order number', () => {
    localStorage.setItem(
      'orders:1',
      JSON.stringify([
        {
          ...mockOrders[0],
          id: 'old-local-order',
          createdAt: '2026-05-10T09:00:00.000Z',
        },
      ])
    );

    const replacement = {
      ...mockOrders[0],
      id: 3,
      orderNumber: 'ORD-100',
      createdAt: '2026-05-10T13:00:00.000Z',
    };

    (service as never as { saveLocalOrder: (order: Order) => void }).saveLocalOrder(replacement);

    const saved = JSON.parse(localStorage.getItem('orders:1') || '[]') as Order[];
    expect(saved).toHaveSize(1);
    expect(saved[0].id).toBe(3);
    expect(saved[0].orderNumber).toBe('ORD-100');
  });

  it('should return the same order when advancing a terminal status', () => {
    const shippedOrder: Order = {
      ...mockOrders[0],
      status: 'shipped',
    };

    service.advanceOrderStatus(shippedOrder).subscribe((order) => {
      expect(order).toEqual(shippedOrder);
    });

    httpMock.expectNone('http://192.168.1.5:3000/orders/1');
  });

  it('should build fallback user details when resolveUser does not match current user', () => {
    const resolved = (service as any).resolveUser({
      userId: 'other-user',
      userName: 'Other User',
      tenantId: 'tenant-b',
    });

    expect(resolved).toEqual({
      id: 'other-user',
      name: 'Other User',
      tenantId: 'tenant-b',
      roles: [],
    });
  });

  it('should advance an order status and persist the update locally', () => {
    service.advanceOrderStatus(mockOrders[0]).subscribe((order) => {
      expect(order.status).toBe('confirmed');
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'confirmed' });
    req.flush({ ...mockOrders[0], status: 'confirmed' });

    const saved = JSON.parse(localStorage.getItem('orders:1') || '[]') as Order[];
    expect(saved[0].status).toBe('confirmed');
  });

  it('should fall back to a local status update when advancing an order fails', () => {
    service.advanceOrderStatus(mockOrders[0]).subscribe((order) => {
      expect(order.status).toBe('confirmed');
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders/1');
    req.error(new ProgressEvent('Network error'));

    const saved = JSON.parse(localStorage.getItem('orders:1') || '[]') as Order[];
    expect(saved[0].status).toBe('confirmed');
  });

  it('should map legacy placed, processing, and delivered statuses to the new lifecycle', () => {
    service.getOrdersForCurrentUser().subscribe((orders) => {
      expect(orders.map((order) => order.status)).toEqual(['pending', 'confirmed', 'shipped']);
    });

    const req = httpMock.expectOne('http://192.168.1.5:3000/orders?userId=1');
    req.flush([
      { ...mockOrders[0], id: 11, orderNumber: 'ORD-011', status: 'placed' },
      { ...mockOrders[0], id: 12, orderNumber: 'ORD-012', status: 'processing' },
      { ...mockOrders[0], id: 13, orderNumber: 'ORD-013', status: 'delivered' },
    ]);
  });
});
