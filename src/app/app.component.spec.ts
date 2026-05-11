import { BehaviorSubject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppComponent } from './app.component';
import { ToastService } from './services/toast.service';
import { AuthService } from './services/auth.service';
import { AppStateService } from './services/app-state.service';
import { User } from './models/user';

describe('AppComponent', () => {
  const toast$ = new BehaviorSubject<string | null>(null);
  const currentUser$ = new BehaviorSubject<User | null>(null);
  const cartCount$ = new BehaviorSubject(0);
  const cartItems$ = new BehaviorSubject<any[]>([]);
  const cartOpen$ = new BehaviorSubject(false);
  const theme$ = new BehaviorSubject<'light' | 'dark'>('light');

  const toastService = jasmine.createSpyObj<ToastService>('ToastService', ['show'], {
    message$: toast$,
  });
  const authService = jasmine.createSpyObj<AuthService>('AuthService', ['signOut'], {
    currentUser$: currentUser$.asObservable(),
  });
  const appState = jasmine.createSpyObj<AppStateService>(
    'AppStateService',
    ['initializeFeatureFlagsFromStorage', 'toggleCart', 'toggleTheme', 'setCartOpen', 'clearCart'],
    {
      cartCount$: cartCount$.asObservable(),
      cartItems$: cartItems$.asObservable(),
      cartOpen$: cartOpen$.asObservable(),
      theme$: theme$.asObservable(),
      cartOpenValue: false,
    }
  );

  beforeEach(async () => {
    authService.signOut.and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: ToastService, useValue: toastService },
        { provide: AuthService, useValue: authService },
        { provide: AppStateService, useValue: appState },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    toast$.next(null);
    currentUser$.next(null);
    cartCount$.next(0);
    cartItems$.next([]);
    cartOpen$.next(false);
    theme$.next('light');
    authService.signOut.calls.reset();
    toastService.show.calls.reset();
    appState.initializeFeatureFlagsFromStorage.calls.reset();
    appState.toggleCart.calls.reset();
    appState.toggleTheme.calls.reset();
    appState.setCartOpen.calls.reset();
    appState.clearCart.calls.reset();
    Object.defineProperty(appState, 'cartOpenValue', {
      configurable: true,
      get: () => false,
    });
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'amazon-angular-workshop' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('amazon-angular-workshop');
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Amazon Angular Workshop');
  });

  it('should initialize feature flags on init', () => {
    const fixture = TestBed.createComponent(AppComponent);

    fixture.detectChanges();

    expect(appState.initializeFeatureFlagsFromStorage).toHaveBeenCalled();
  });

  it('should toggle cart', () => {
    const fixture = TestBed.createComponent(AppComponent);

    fixture.componentInstance.toggleCart();

    expect(appState.toggleCart).toHaveBeenCalled();
  });

  it('should toggle theme', () => {
    const fixture = TestBed.createComponent(AppComponent);

    fixture.componentInstance.toggleTheme();

    expect(appState.toggleTheme).toHaveBeenCalled();
  });

  it('should return primary role and badge class for a user', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const user: User = {
      id: '1',
      name: 'Alex Smith',
      tenantId: 'north-america',
      roles: ['admin', 'customer'],
    };

    expect(fixture.componentInstance.getPrimaryRole(user)).toBe('admin');
    expect(fixture.componentInstance.getRoleBadgeClass(user)).toBe('role-badge admin');
  });

  it('should default primary role to customer when roles are missing', () => {
    const fixture = TestBed.createComponent(AppComponent);

    expect(fixture.componentInstance.getPrimaryRole({ id: '2', name: 'Guest', tenantId: 'tenant-a' } as User)).toBe('customer');
    expect(fixture.componentInstance.getRoleBadgeClass({ id: '2', name: 'Guest', tenantId: 'tenant-a' } as User)).toBe('role-badge customer');
  });

  it('should close cart on escape when cart is open', () => {
    const fixture = TestBed.createComponent(AppComponent);
    Object.defineProperty(appState, 'cartOpenValue', {
      configurable: true,
      get: () => true,
    });

    fixture.componentInstance.onEscape();

    expect(appState.setCartOpen).toHaveBeenCalledWith(false);
  });

  it('should not close cart on escape when cart is closed', () => {
    const fixture = TestBed.createComponent(AppComponent);

    fixture.componentInstance.onEscape();

    expect(appState.setCartOpen).not.toHaveBeenCalled();
  });

  it('should sign out and navigate to sign-in', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    await fixture.componentInstance.signOut();

    expect(authService.signOut).toHaveBeenCalled();
    expect(appState.clearCart).toHaveBeenCalled();
    expect(appState.setCartOpen).toHaveBeenCalledWith(false);
    expect(toastService.show).toHaveBeenCalledWith('Signed out.');
    expect(router.navigate).toHaveBeenCalledWith(['/sign-in']);
  });
});
