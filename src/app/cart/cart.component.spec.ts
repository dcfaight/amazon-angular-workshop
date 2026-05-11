import { BehaviorSubject } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { skip, take } from 'rxjs/operators';

import { CartComponent } from './cart.component';
import { AppStateService } from '../services/app-state.service';

describe('CartComponent', () => {
  let component: CartComponent;
  let fixture: ComponentFixture<CartComponent>;
  const cartItems$ = new BehaviorSubject<any[]>([]);
  const appState = jasmine.createSpyObj<AppStateService>('AppStateService', ['clearCart', 'setCartItemQuantity'], {
    cartItems$: cartItems$.asObservable(),
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartComponent],
      providers: [
        provideRouter([]),
        { provide: AppStateService, useValue: appState }
      ],
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  beforeEach(() => {
    appState.clearCart.calls.reset();
    appState.setCartItemQuantity.calls.reset();
    cartItems$.next([]);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should clear cart', () => {
    component.clearCart();

    expect(appState.clearCart).toHaveBeenCalled();
  });

  it('should calculate cart total', (done) => {
    component.cartTotal$.pipe(skip(1), take(1)).subscribe((total) => {
      expect(total).toBe(25.25);
      done();
    });

    cartItems$.next([{ price: 10 }, { price: 15.25 }] as any[]);
  });

  it('should group duplicate cart products into line items', (done) => {
    component.cartLineItems$.pipe(skip(1), take(1)).subscribe((lines) => {
      expect(lines.length).toBe(1);
      expect(lines[0].quantity).toBe(2);
      expect(lines[0].lineTotal).toBe(20);
      done();
    });

    cartItems$.next([
      { id: 1, price: 10, title: 'A', imageUrl: 'x' },
      { id: 1, price: 10, title: 'A', imageUrl: 'x' },
    ] as any[]);
  });

  it('should increase quantity', () => {
    component.increaseQuantity(1, 2);

    expect(appState.setCartItemQuantity).toHaveBeenCalledWith(1, 3);
  });

  it('should decrease quantity', () => {
    component.decreaseQuantity(1, 2);

    expect(appState.setCartItemQuantity).toHaveBeenCalledWith(1, 1);
  });

  it('should remove item line', () => {
    component.removeItem(1);

    expect(appState.setCartItemQuantity).toHaveBeenCalledWith(1, 0);
  });

  it('should disable increment at stock cap', () => {
    expect(component.isIncreaseDisabled({ inStock: true, stockCount: 2 } as any, 2)).toBeTrue();
  });

  it('should disable increment for out-of-stock products', () => {
    expect(component.isIncreaseDisabled({ inStock: false } as any, 0)).toBeTrue();
  });

  it('should use the default stock cap when stockCount is missing', () => {
    expect(component.isIncreaseDisabled({ inStock: true } as any, 4)).toBeFalse();
    expect(component.getRemainingStock({ inStock: true } as any, 4)).toBe(1);
  });

  it('should compute remaining stock for a cart line', () => {
    expect(component.getRemainingStock({ inStock: true, stockCount: 5 } as any, 3)).toBe(2);
  });

  it('should mark cart line as low stock when remaining quantity is low', () => {
    expect(component.isLowStock({ inStock: true, stockCount: 3 } as any, 2)).toBeTrue();
  });

  it('should return low-stock state label and class for low remaining quantity', () => {
    const product = { inStock: true, stockCount: 3 } as any;

    expect(component.getStockStateLabel(product, 2)).toBe('Low Stock');
    expect(component.getStockStateClass(product, 2)).toBe('stock-state stock-state--low-stock');
  });

  it('should return in-stock state label and class for healthy inventory', () => {
    const product = { inStock: true, stockCount: 5 } as any;

    expect(component.getStockStateLabel(product, 1)).toBe('In Stock');
    expect(component.getStockStateClass(product, 1)).toBe('stock-state stock-state--in-stock');
  });
});
