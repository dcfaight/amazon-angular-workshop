import { BehaviorSubject, of, throwError } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { CheckoutComponent } from './checkout.component';
import { CheckoutError } from '../models/checkout';
import { Product } from '../models/product';
import { AppStateService } from '../services/app-state.service';
import { AuthService } from '../services/auth.service';
import { CheckoutService } from '../services/checkout.service';
import { OrderService } from '../services/order.service';
import { ToastService } from '../services/toast.service';

describe('CheckoutComponent', () => {
  let component: CheckoutComponent;
  let fixture: ComponentFixture<CheckoutComponent>;
  let router: Router;

  const cartItems$ = new BehaviorSubject<Product[]>([]);
  const appState = jasmine.createSpyObj<AppStateService>('AppStateService', ['clearCart', 'setCartOpen'], {
    cartItems$: cartItems$.asObservable(),
  });
  const checkoutService = jasmine.createSpyObj<CheckoutService>('CheckoutService', ['placeOrder']);
  const orderService = jasmine.createSpyObj<OrderService>('OrderService', ['createOrder']);
  const toastService = jasmine.createSpyObj<ToastService>('ToastService', ['show']);
  const authService = jasmine.createSpyObj<AuthService>('AuthService', [], {
    currentUserValue: {
      id: '1',
      name: 'Alex Smith',
      tenantId: 'north-america',
      roles: ['admin'],
    },
  });

  const mockProduct: Product = {
    id: 1,
    title: 'Kindle',
    description: 'Reader',
    price: 100,
    imageUrl: 'http://image.test',
    inStock: true,
  };

  beforeEach(async () => {
    checkoutService.placeOrder.and.resolveTo({
      orderId: 'ORD-123',
      placedAtIso: new Date().toISOString(),
      total: 100,
      itemCount: 1,
      etaDays: 3,
    });
    orderService.createOrder.and.returnValue(of({
      id: 99,
      orderNumber: 'ORD-123',
      userId: '1',
      userName: 'Alex Smith',
      tenantId: 'north-america',
      createdAt: new Date().toISOString(),
      status: 'pending',
      subtotal: 100,
      total: 100,
      totalItems: 1,
      shippingAddress: {
        fullName: 'Alex Smith',
        addressLine1: '123 Main St',
        city: 'Seattle',
        state: 'WA',
        zip: '98101',
      },
      paymentMethod: 'card',
      items: [],
    }));

    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        provideRouter([]),
        { provide: AppStateService, useValue: appState },
        { provide: CheckoutService, useValue: checkoutService },
        { provide: OrderService, useValue: orderService },
        { provide: AuthService, useValue: authService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  beforeEach(() => {
    cartItems$.next([mockProduct]);
    appState.clearCart.calls.reset();
    appState.setCartOpen.calls.reset();
    checkoutService.placeOrder.calls.reset();
    orderService.createOrder.calls.reset();
    toastService.show.calls.reset();
    component.errorMessage = null;
    component.step = 'shipping';
    component.shipping = {
      fullName: '',
      addressLine1: '',
      city: '',
      state: '',
      zip: '',
    };
    component.payment = { method: 'card', cardLast4: '' };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should block moving to payment when shipping data is incomplete', () => {
    component.goToPayment();

    expect(component.step).toBe('shipping');
    expect(component.errorMessage).toBe('Please complete all shipping fields.');
  });

  it('should move through steps when data is valid', () => {
    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };

    component.goToPayment();
    expect(component.step).toBe('payment');

    component.payment = { method: 'card', cardLast4: '4242' };
    component.goToReview();

    expect(component.step).toBe('review');
    expect(component.errorMessage).toBeNull();
  });

  it('should place order successfully and clear cart', async () => {
    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };
    component.payment = { method: 'card', cardLast4: '4242' };
    component.step = 'review';

    await component.placeOrder();

    expect(checkoutService.placeOrder).toHaveBeenCalled();
    expect(orderService.createOrder).toHaveBeenCalledWith(jasmine.objectContaining({
      orderNumber: 'ORD-123',
      userId: '1',
      userName: 'Alex Smith',
      tenantId: 'north-america',
      status: 'pending',
      total: 100,
      totalItems: 1,
      paymentMethod: 'card',
    }));
    expect(appState.clearCart).toHaveBeenCalled();
    expect(appState.setCartOpen).toHaveBeenCalledWith(false);
    expect(component.step).toBe('success');
    expect(toastService.show).toHaveBeenCalledWith('Order ORD-123 placed successfully!');
  });

  it('should show an error when checkout fails', async () => {
    checkoutService.placeOrder.and.rejectWith(new Error('Checkout failed'));
    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };
    component.payment = { method: 'card', cardLast4: '4242' };
    component.step = 'review';

    await component.placeOrder();

    expect(component.errorMessage).toBe('Checkout failed');
    expect(component.step).toBe('review');
    expect(toastService.show).toHaveBeenCalledWith('Checkout failed. Please try again.');
  });

  it('should surface typed checkout failure messages', async () => {
    checkoutService.placeOrder.and.rejectWith(
      new CheckoutError({
        reason: 'INSUFFICIENT_STOCK',
        message: 'Stock changed for "Kindle". Requested 1, but only 0 left.',
        productId: 1,
        requestedQuantity: 1,
        availableQuantity: 0,
      })
    );
    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };
    component.payment = { method: 'card', cardLast4: '4242' };
    component.step = 'review';

    await component.placeOrder();

    expect(component.errorMessage).toContain('Stock changed for "Kindle"');
    expect(toastService.show).toHaveBeenCalledWith('Checkout failed. Please try again.');
  });

  it('should keep cart intact when order persistence fails', async () => {
    orderService.createOrder.and.returnValue(throwError(() => new Error('Order save failed')));
    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };
    component.payment = { method: 'card', cardLast4: '4242' };
    component.step = 'review';

    await component.placeOrder();

    expect(checkoutService.placeOrder).toHaveBeenCalled();
    expect(orderService.createOrder).toHaveBeenCalled();
    expect(appState.clearCart).not.toHaveBeenCalled();
    expect(component.step).toBe('review');
    expect(component.errorMessage).toBe('Order save failed');
  });

  it('should group duplicate items into checkout line items', () => {
    cartItems$.next([mockProduct, { ...mockProduct }]);

    const lines = component.cartLineItems;

    expect(lines.length).toBe(1);
    expect(lines[0].quantity).toBe(2);
    expect(lines[0].lineTotal).toBe(200);
  });

  it('should go back to previous checkout steps from top back action', async () => {
    component.step = 'review';
    await component.goBack();
    expect(component.step).toBe('payment');

    await component.goBack();
    expect(component.step).toBe('shipping');
  });

  it('should navigate to cart when top back is pressed on shipping step', async () => {
    spyOn(router, 'navigate').and.resolveTo(true);
    component.step = 'shipping';

    await component.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/cart']);
  });

  it('should navigate home when top back is pressed on success step', async () => {
    spyOn(router, 'navigate').and.resolveTo(true);
    component.step = 'success';

    await component.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should navigate home when continue shopping is triggered', async () => {
    spyOn(router, 'navigate').and.resolveTo(true);

    await component.continueShopping();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  // Edge case tests for Slice 4
  it('should prevent order placement with empty cart', async () => {
    cartItems$.next([]);
    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };
    component.payment = { method: 'card', cardLast4: '4242' };
    component.step = 'review';

    await component.placeOrder();

    expect(component.errorMessage).toBe('Your cart is empty. Add items before placing an order.');
    expect(checkoutService.placeOrder).not.toHaveBeenCalled();
  });

  it('should prevent order placement when checkout details are invalid', async () => {
    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };
    component.payment = { method: 'card', cardLast4: '' };
    component.step = 'review';

    await component.placeOrder();

    expect(component.errorMessage).toBe('Please complete checkout details before placing your order.');
    expect(checkoutService.placeOrder).not.toHaveBeenCalled();
  });

  it('should surface a sign-in error when building an order without a user', () => {
    const originalUserDescriptor = Object.getOwnPropertyDescriptor(authService, 'currentUserValue');
    Object.defineProperty(authService, 'currentUserValue', {
      value: null,
      configurable: true,
    });

    expect(() => (component as unknown as { buildOrderRecord: (confirmation: unknown) => unknown }).buildOrderRecord({
      orderId: 'ORD-123',
      placedAtIso: new Date().toISOString(),
      total: 100,
      itemCount: 1,
      etaDays: 3,
    })).toThrowError('You must be signed in to place an order.');

    if (originalUserDescriptor) {
      Object.defineProperty(authService, 'currentUserValue', originalUserDescriptor);
    }
  });

  it('should trim whitespace in validation and reject shipping with only spaces', () => {
    component.shipping = {
      fullName: '   ',
      addressLine1: '   ',
      city: '   ',
      state: '   ',
      zip: '   ',
    };

    component.goToPayment();

    expect(component.step).toBe('shipping');
    expect(component.errorMessage).toBe('Please complete all shipping fields.');
  });

  it('should set formSubmitted flag when attempting to move to payment', () => {
    expect(component.formSubmitted).toBeFalsy();

    component.goToPayment();

    expect(component.formSubmitted).toBeTruthy();
  });

  it('should set formSubmitted flag when attempting to move to review', () => {
    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };
    component.goToPayment();
    expect(component.formSubmitted).toBeTruthy();

    component.payment = { method: 'card', cardLast4: '' };

    component.goToReview();

    expect(component.formSubmitted).toBeTruthy();
  });

  it('should reset formSubmitted when going back from payment to shipping', () => {
    component.formSubmitted = true;
    component.step = 'payment';

    component.backToShipping();

    expect(component.formSubmitted).toBeFalsy();
  });

  it('should reset formSubmitted when going back from review to payment', () => {
    component.formSubmitted = true;
    component.step = 'review';

    component.backToPayment();

    expect(component.formSubmitted).toBeFalsy();
  });

  it('should accept PayPal payment without card details', () => {
    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };
    component.payment = { method: 'paypal', cardLast4: '' };
    component.step = 'payment';

    component.goToReview();

    expect(component.step).toBe('review');
    expect(component.errorMessage).toBeNull();
  });

  it('should require card number for card payment method', () => {
    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };
    component.payment = { method: 'card', cardLast4: '' };
    component.step = 'payment';

    component.goToReview();

    expect(component.step).toBe('payment');
    expect(component.errorMessage).toBe('Please provide valid payment details.');
  });

  it('should calculate subtotal correctly with multiple items', () => {
    cartItems$.next([
      mockProduct,
      { ...mockProduct, id: 2, price: 50 },
      { ...mockProduct, id: 1, price: 100 },
    ]);

    expect(component.subtotal).toBe(250);
  });

  it('should handle network errors gracefully', async () => {
    const networkError = new Error('Network timeout');
    checkoutService.placeOrder.and.rejectWith(networkError);
    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };
    component.payment = { method: 'card', cardLast4: '4242' };
    component.step = 'review';

    await component.placeOrder();

    expect(component.errorMessage).toContain('Network timeout');
    expect(component.step).toBe('review');
    expect(component.isSubmitting).toBeFalsy();
  });

  it('should show a fallback message for non-Error checkout failures', async () => {
    checkoutService.placeOrder.and.rejectWith('service unavailable');
    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };
    component.payment = { method: 'card', cardLast4: '4242' };
    component.step = 'review';

    await component.placeOrder();

    expect(component.errorMessage).toBe('Unable to place order right now.');
    expect(toastService.show).toHaveBeenCalledWith('Checkout failed. Please try again.');
  });

  it('should disable submit button while order is being placed', async () => {
    const confirmationData = { orderId: 'ORD-123', total: 100, itemCount: 1, etaDays: 3, placedAtIso: new Date().toISOString() };
    checkoutService.placeOrder.and.returnValue(Promise.resolve(confirmationData));

    component.shipping = {
      fullName: 'Test User',
      addressLine1: '123 Main St',
      city: 'Seattle',
      state: 'WA',
      zip: '98101',
    };
    component.payment = { method: 'card', cardLast4: '4242' };
    component.step = 'review';

    const placeOrderPromise = component.placeOrder();
    expect(component.isSubmitting).toBeTruthy();

    await placeOrderPromise;
    expect(component.isSubmitting).toBeFalsy();
  });
});
