import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { OrderHistoryComponent } from './order-history.component';
import { OrderService } from '../services/order.service';
import { ToastService } from '../services/toast.service';
import { Order } from '../models/order';

describe('OrderHistoryComponent', () => {
  let component: OrderHistoryComponent;
  let fixture: ComponentFixture<OrderHistoryComponent>;
  let orderService: jasmine.SpyObj<OrderService>;
  let toastService: jasmine.SpyObj<ToastService>;

  const mockOrders: Order[] = [
    {
      id: 1,
      orderNumber: 'ORD-123',
      userId: '1',
      userName: 'Alex Smith',
      tenantId: 'north-america',
      createdAt: '2026-05-10T10:00:00.000Z',
      status: 'pending',
      subtotal: 129.99,
      total: 129.99,
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
          title: 'Wireless Headphones',
          price: 129.99,
          quantity: 1,
          imageUrl: 'https://example.com/image.jpg',
        },
      ],
    },
  ];

  beforeEach(async () => {
    orderService = jasmine.createSpyObj<OrderService>('OrderService', ['getOrdersForCurrentUser', 'advanceOrderStatus']);
    toastService = jasmine.createSpyObj<ToastService>('ToastService', ['show']);
    orderService.getOrdersForCurrentUser.and.returnValue(of(mockOrders));
    orderService.advanceOrderStatus.and.returnValue(of({ ...mockOrders[0], status: 'confirmed' }));

    await TestBed.configureTestingModule({
      imports: [OrderHistoryComponent],
      providers: [
        provideRouter([]),
        { provide: OrderService, useValue: orderService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load orders on init', () => {
    expect(orderService.getOrdersForCurrentUser).toHaveBeenCalled();
    expect(component.orders).toEqual(mockOrders);
    expect(component.loading).toBeFalse();
  });

  it('should show empty state when no orders exist', () => {
    orderService.getOrdersForCurrentUser.and.returnValue(of([]));
    component.loadOrders();

    expect(component.orders).toEqual([]);
    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBeNull();
  });

  it('should handle load errors', () => {
    orderService.getOrdersForCurrentUser.and.returnValue(
      throwError(() => new Error('Load failed'))
    );

    component.loadOrders();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toBe('Unable to load your order history right now.');
    expect(toastService.show).toHaveBeenCalledWith('Failed to load order history.');
  });

  it('should return a class name for order status', () => {
    expect(component.getStatusClass(mockOrders[0])).toBe('status-pill pending');
  });

  it('should mark reached status steps correctly', () => {
    const shippedOrder = { ...mockOrders[0], status: 'shipped' as const };

    expect(component.isStepReached(shippedOrder, 'pending')).toBeTrue();
    expect(component.isStepReached(shippedOrder, 'confirmed')).toBeTrue();
    expect(component.isStepReached(shippedOrder, 'shipped')).toBeTrue();
  });

  it('should expose the next status label and allow advancing status', () => {
    expect(component.canAdvanceStatus(mockOrders[0])).toBeTrue();
    expect(component.getNextStatusLabel(mockOrders[0])).toBe('confirmed');

    component.advanceStatus(mockOrders[0]);

    expect(orderService.advanceOrderStatus).toHaveBeenCalledWith(mockOrders[0]);
    expect(component.orders[0].status).toBe('confirmed');
    expect(toastService.show).toHaveBeenCalledWith('Order ORD-123 marked confirmed.');
  });

  it('should not allow advancing a shipped order', () => {
    const shippedOrder = { ...mockOrders[0], status: 'shipped' as const };

    expect(component.canAdvanceStatus(shippedOrder)).toBeFalse();
    expect(component.getNextStatusLabel(shippedOrder)).toBe('shipped');
  });

  it('should track orders by id', () => {
    expect(component.trackByOrderId(0, mockOrders[0])).toBe(1);
  });

  it('should not re-submit an order that is already being updated', () => {
    component.updatingOrderId = mockOrders[0].id;

    component.advanceStatus(mockOrders[0]);

    expect(orderService.advanceOrderStatus).not.toHaveBeenCalled();
  });

  it('should handle errors when advancing order status', () => {
    orderService.advanceOrderStatus.and.returnValue(throwError(() => new Error('Update failed')));

    component.advanceStatus(mockOrders[0]);

    expect(toastService.show).toHaveBeenCalledWith('Unable to update order status right now.');
    expect(component.updatingOrderId).toBeNull();
  });

  it('should render legacy order fallbacks for missing receipt fields', () => {
    const legacyOrder: Order = {
      id: 'legacy-1',
      orderNumber: '',
      userId: '1',
      userName: 'Alex Smith',
      tenantId: 'north-america',
      createdAt: '2026-05-10T10:00:00.000Z',
      status: 'pending',
      subtotal: 0,
      total: 0,
      totalItems: 0,
      shippingAddress: undefined as any,
      paymentMethod: undefined as any,
      items: [],
    };

    expect(component.getOrderNumber(legacyOrder)).toBe('legacy-1');
    expect(component.getShippingName(legacyOrder)).toBe('Alex Smith');
    expect(component.getShippingLine1(legacyOrder)).toBe('Shipping details not available for this order.');
    expect(component.getShippingCityLine(legacyOrder)).toBe('Legacy order record');
    expect(component.getPaymentLabel(legacyOrder)).toBe('N/A');
  });
});
