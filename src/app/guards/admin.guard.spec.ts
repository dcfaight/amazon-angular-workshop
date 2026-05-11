import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

describe('adminGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  const runGuard = () =>
    TestBed.runInInjectionContext(() => adminGuard(mockRoute, mockState));

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', [], { currentUserValue: null });
    router = jasmine.createSpyObj('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue({} as any);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('should allow access for admin users', () => {
    (Object.getOwnPropertyDescriptor(authService, 'currentUserValue')?.get as any);
    authService = jasmine.createSpyObj('AuthService', [], {
      currentUserValue: { id: '1', name: 'Admin', tenantId: 'tenant-a', roles: ['admin'] }
    });
    TestBed.overrideProvider(AuthService, { useValue: authService });
    const result = runGuard();
    expect(result).toBeTrue();
  });

  it('should redirect non-admin users to home', () => {
    authService = jasmine.createSpyObj('AuthService', [], {
      currentUserValue: { id: '2', name: 'User', tenantId: 'tenant-a', roles: ['user'] }
    });
    TestBed.overrideProvider(AuthService, { useValue: authService });
    const result = runGuard();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
  });

  it('should redirect users with no roles to home', () => {
    authService = jasmine.createSpyObj('AuthService', [], {
      currentUserValue: { id: '3', name: 'NoRole', tenantId: 'tenant-a' }
    });
    TestBed.overrideProvider(AuthService, { useValue: authService });
    const result = runGuard();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
  });

  it('should redirect unauthenticated users to home', () => {
    authService = jasmine.createSpyObj('AuthService', [], { currentUserValue: null });
    TestBed.overrideProvider(AuthService, { useValue: authService });
    const result = runGuard();
    expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
  });
});
