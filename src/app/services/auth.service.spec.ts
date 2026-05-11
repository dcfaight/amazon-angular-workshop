import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { User } from '../models/user';
import { environment } from '../../environments/environment';
import {
  AmplifyAuthAdapter,
  AmplifyCurrentUser,
  AmplifySignInResult,
  AmplifyUserAttributes,
} from './amplify-auth.adapter';

describe('AuthService', () => {
  let service: AuthService;
  let amplifyAuth: jasmine.SpyObj<AmplifyAuthAdapter>;
  let httpMock: HttpTestingController;
  let originalUseAmplifyAuth: boolean;

  const mockAmplifyUser: AmplifyCurrentUser = {
    userId: 'amplify-user-id',
    username: 'amplify-user',
  };

  const mockAmplifyAttributes: AmplifyUserAttributes = {
    name: 'Amplify User',
    'custom:tenantId': 'tenant-b',
    'custom:roles': 'admin,customer',
  };

  const doneSignIn: AmplifySignInResult = {
    nextStep: { signInStep: 'DONE' },
  };

  function configureService(platformId: 'browser' | 'server', useAmplifyAuth: boolean): void {
    environment.features.useAmplifyAuth = useAmplifyAuth;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: PLATFORM_ID, useValue: platformId },
        { provide: AmplifyAuthAdapter, useValue: amplifyAuth },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  function expectUserLookup(username: string): ReturnType<HttpTestingController['expectOne']> {
    const encoded = encodeURIComponent(username);
    return httpMock.expectOne(
      `http://192.168.1.5:3000/users?username=${encoded}`
    );
  }

  function expectEmailLookup(email: string): ReturnType<HttpTestingController['expectOne']> {
    const encoded = encodeURIComponent(email);
    return httpMock.expectOne(
      `http://192.168.1.5:3000/users?email=${encoded}`
    );
  }

  function expectNameLookup(name: string): ReturnType<HttpTestingController['expectOne']> {
    const encoded = encodeURIComponent(name);
    return httpMock.expectOne(
      `http://192.168.1.5:3000/users?name=${encoded}`
    );
  }

  beforeEach(() => {
    localStorage.clear();
    originalUseAmplifyAuth = environment.features.useAmplifyAuth;

    amplifyAuth = jasmine.createSpyObj<AmplifyAuthAdapter>(
      'AmplifyAuthAdapter',
      ['signIn', 'signOut', 'getCurrentUser', 'fetchUserAttributes']
    );
    amplifyAuth.signIn.and.resolveTo(doneSignIn);
    amplifyAuth.signOut.and.resolveTo();
    amplifyAuth.getCurrentUser.and.resolveTo(mockAmplifyUser);
    amplifyAuth.fetchUserAttributes.and.resolveTo(mockAmplifyAttributes);

    configureService('browser', false);
  });

  afterEach(() => {
    httpMock.verify();
    environment.features.useAmplifyAuth = originalUseAmplifyAuth;
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have currentUser$ observable', () => {
    expect(service.currentUser$).toBeDefined();
  });

  it('should initialize with null user', (done) => {
    service.currentUser$.subscribe((user) => {
      expect(user).toBeNull();
      done();
    });
  });

  it('should return null for currentUserValue when not signed in', () => {
    expect(service.currentUserValue).toBeNull();
  });

  it('should initialize auth state from localStorage when Amplify is disabled', async () => {
    const mockUser: User = {
      id: 'test-user',
      name: 'Test User',
      tenantId: 'tenant-a',
      roles: ['customer'],
    };

    localStorage.setItem('currentUser', JSON.stringify(mockUser));

    configureService('browser', false);
    await service.initializeAuthState();

    expect(service.currentUserValue).toEqual(mockUser);
    expect(amplifyAuth.getCurrentUser).not.toHaveBeenCalled();
  });

  it('should initialize with null when no saved user exists and Amplify is disabled', async () => {
    configureService('browser', false);

    await service.initializeAuthState();

    expect(service.currentUserValue).toBeNull();
  });

  it('should initialize auth state from Amplify when Amplify is enabled', async () => {
    configureService('browser', true);

    await service.initializeAuthState();

    expect(amplifyAuth.getCurrentUser).toHaveBeenCalled();
    expect(amplifyAuth.fetchUserAttributes).toHaveBeenCalled();
    expect(service.currentUserValue).toEqual({
      id: 'amplify-user-id',
      name: 'Amplify User',
      tenantId: 'tenant-b',
      roles: ['admin', 'customer'],
    });
  });

  it('should use fallback Amplify values when optional attributes are missing', async () => {
    configureService('browser', true);
    amplifyAuth.fetchUserAttributes.and.resolveTo({});

    await service.initializeAuthState();

    expect(service.currentUserValue).toEqual({
      id: 'amplify-user-id',
      name: 'amplify-user',
      tenantId: 'tenant-a',
      roles: ['customer'],
    });
  });

  it('should keep cached local user when Amplify restore fails', async () => {
    const cachedUser: User = {
      id: 'cached-user',
      name: 'Cached User',
      tenantId: 'tenant-c',
      roles: ['customer'],
    };
    localStorage.setItem('currentUser', JSON.stringify(cachedUser));
    amplifyAuth.getCurrentUser.and.rejectWith(new Error('No current user'));

    configureService('browser', true);
    await service.initializeAuthState();

    expect(service.currentUserValue).toEqual(cachedUser);
    expect(JSON.parse(localStorage.getItem('currentUser') || 'null')).toEqual(cachedUser);
  });

  it('should clear storage when Amplify restore fails without cached user', async () => {
    configureService('browser', true);
    amplifyAuth.getCurrentUser.and.rejectWith(new Error('No current user'));
    const removeItemSpy = spyOn(localStorage, 'removeItem').and.callThrough();

    await service.initializeAuthState();

    expect(service.currentUserValue).toBeNull();
    expect(removeItemSpy).toHaveBeenCalledWith('currentUser');
  });

  it('should return early in restoreAmplifyUser on server platform', async () => {
    configureService('server', true);

    await (service as any).restoreAmplifyUser(null);

    expect(amplifyAuth.getCurrentUser).not.toHaveBeenCalled();
  });

  it('should handle SSR initialize without touching browser storage', async () => {
    configureService('server', true);

    await service.initializeAuthState();

    expect(service.currentUserValue).toBeNull();
    expect(amplifyAuth.getCurrentUser).not.toHaveBeenCalled();
  });

  it('should sign in locally when Amplify is disabled', async () => {
    const signInPromise = service.signIn({ username: ' Test User ', password: 'password' });
    await Promise.resolve();
    const req = expectUserLookup('Test User');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await Promise.resolve();
    const nameReq = expectNameLookup('Test User');
    expect(nameReq.request.method).toBe('GET');
    nameReq.flush([]);
    await signInPromise;

    expect(service.currentUserValue).toEqual({
      id: 'test user',
      name: 'Test User',
      tenantId: 'tenant-a',
      roles: ['customer'],
    });
    expect(JSON.parse(localStorage.getItem('currentUser') || 'null')).toEqual(service.currentUserValue);
    expect(amplifyAuth.signIn).not.toHaveBeenCalled();
  });

  it('should fall back to a local user when the API lookup fails', async () => {
    const signInPromise = service.signIn({ username: 'Lookup Failure', password: 'password' });
    await Promise.resolve();

    const req = expectUserLookup('Lookup Failure');
    expect(req.request.method).toBe('GET');
    req.error(new ProgressEvent('Network error'));

    await signInPromise;

    expect(service.currentUserValue).toEqual({
      id: 'lookup failure',
      name: 'Lookup Failure',
      tenantId: 'tenant-a',
      roles: ['customer'],
    });
  });

  it('should sign in from Amplify and hydrate user when Amplify succeeds', async () => {
    configureService('browser', true);

    await service.signIn({ username: 'amplify-user', password: 'password' });

    expect(amplifyAuth.signIn).toHaveBeenCalledWith({
      username: 'amplify-user',
      password: 'password',
    });
    expect(service.currentUserValue).toEqual({
      id: 'amplify-user-id',
      name: 'Amplify User',
      tenantId: 'tenant-b',
      roles: ['admin', 'customer'],
    });
  });

  it('should fall back to local user when Amplify sign-in throws', async () => {
    configureService('browser', true);
    amplifyAuth.signIn.and.rejectWith(new Error('Amplify sign-in failed'));

    const signInPromise = service.signIn({ username: 'Fallback User', password: 'password' });
    await Promise.resolve();
    const req = expectUserLookup('Fallback User');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await Promise.resolve();
    const nameReq = expectNameLookup('Fallback User');
    expect(nameReq.request.method).toBe('GET');
    nameReq.flush([]);
    await signInPromise;

    expect(service.currentUserValue).toEqual({
      id: 'fallback user',
      name: 'Fallback User',
      tenantId: 'tenant-a',
      roles: ['customer'],
    });
  });

  it('should fall back to local user when Amplify requests additional steps', async () => {
    configureService('browser', true);
    amplifyAuth.signIn.and.resolveTo({
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_SMS_CODE' },
    } as AmplifySignInResult);

    const signInPromise = service.signIn({ username: 'Step User', password: 'password' });
    await Promise.resolve();
    const req = expectUserLookup('Step User');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await Promise.resolve();
    const nameReq = expectNameLookup('Step User');
    expect(nameReq.request.method).toBe('GET');
    nameReq.flush([]);
    await signInPromise;

    expect(service.currentUserValue).toEqual({
      id: 'step user',
      name: 'Step User',
      tenantId: 'tenant-a',
      roles: ['customer'],
    });
  });

  it('should use fallback username and provided tenant when local sign-in data is blank', async () => {
    await service.signIn({ username: '   ', password: 'password', tenantId: ' tenant-b ' });

    expect(service.currentUserValue).toEqual({
      id: 'local-user',
      name: 'Local User',
      tenantId: 'tenant-b',
      roles: ['customer'],
    });
  });

  it('should clear user state and storage on signOut when Amplify is disabled', async () => {
    const signInPromise = service.signIn({ username: 'Test User', password: 'password' });
    await Promise.resolve();
    const req = expectUserLookup('Test User');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    await Promise.resolve();
    const nameReq = expectNameLookup('Test User');
    expect(nameReq.request.method).toBe('GET');
    nameReq.flush([]);
    await signInPromise;

    await service.signOut();

    expect(service.currentUserValue).toBeNull();
    expect(localStorage.getItem('currentUser')).toBeNull();
    expect(amplifyAuth.signOut).not.toHaveBeenCalled();
  });

  it('should call Amplify signOut when Amplify is enabled', async () => {
    configureService('browser', true);
    await service.signIn({ username: 'amplify-user', password: 'password' });

    await service.signOut();

    expect(amplifyAuth.signOut).toHaveBeenCalled();
    expect(service.currentUserValue).toBeNull();
    expect(localStorage.getItem('currentUser')).toBeNull();
  });

  it('should still clear local state when Amplify signOut fails', async () => {
    configureService('browser', true);
    await service.signIn({ username: 'amplify-user', password: 'password' });
    amplifyAuth.signOut.and.rejectWith(new Error('Sign-out failed'));

    await service.signOut();

    expect(service.currentUserValue).toBeNull();
    expect(localStorage.getItem('currentUser')).toBeNull();
  });

  it('should reject sign-in on the server platform', async () => {
    configureService('server', false);

    await expectAsync(
      service.signIn({ username: 'Test User', password: 'password' })
    ).toBeRejectedWithError('Sign-in is only available in the browser.');
  });

  it('should hydrate local user roles from backend record when available', async () => {
    const signInPromise = service.signIn({ username: 'admin.user', password: 'password123' });
    await Promise.resolve();
    const req = expectUserLookup('admin.user');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: '7',
        username: 'admin.user',
        name: 'Admin User',
        tenantId: 'tenant-a',
        roles: ['admin', 'customer'],
        password: 'password123',
      },
    ]);
    await signInPromise;

    expect(service.currentUserValue).toEqual({
      id: '7',
      name: 'Admin User',
      tenantId: 'tenant-a',
      roles: ['admin', 'customer'],
    });
  });

  it('should ignore backend user record when password does not match', async () => {
    const signInPromise = service.signIn({ username: 'admin.user', password: 'wrong-password' });
    await Promise.resolve();
    const req = expectUserLookup('admin.user');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: '7',
        username: 'admin.user',
        name: 'Admin User',
        tenantId: 'tenant-a',
        roles: ['admin', 'customer'],
        password: 'password123',
      },
    ]);
    await signInPromise;

    expect(service.currentUserValue).toEqual({
      id: 'admin.user',
      name: 'admin.user',
      tenantId: 'tenant-a',
      roles: ['customer'],
    });
  });

  it('should hydrate admin user from email-based db records', async () => {
    const signInPromise = service.signIn({ username: 'alex.smith1@example.com', password: 'any' });
    await Promise.resolve();

    const usernameReq = expectUserLookup('alex.smith1@example.com');
    expect(usernameReq.request.method).toBe('GET');
    usernameReq.flush([]);

    await Promise.resolve();
    const emailReq = expectEmailLookup('alex.smith1@example.com');
    expect(emailReq.request.method).toBe('GET');
    emailReq.flush([
      {
        id: 1,
        name: 'Alex Smith',
        email: 'alex.smith1@example.com',
        tenantId: 'north-america',
        roles: ['admin'],
      },
    ]);

    await signInPromise;

    expect(service.currentUserValue).toEqual({
      id: '1',
      name: 'Alex Smith',
      tenantId: 'north-america',
      roles: ['admin'],
    });
  });

  it('should hydrate admin user from name-based db records', async () => {
    const signInPromise = service.signIn({ username: 'Alex Smith', password: 'any' });
    await Promise.resolve();

    const usernameReq = expectUserLookup('Alex Smith');
    expect(usernameReq.request.method).toBe('GET');
    usernameReq.flush([]);

    await Promise.resolve();
    const nameReq = expectNameLookup('Alex Smith');
    expect(nameReq.request.method).toBe('GET');
    nameReq.flush([
      {
        id: 1,
        name: 'Alex Smith',
        email: 'alex.smith1@example.com',
        tenantId: 'north-america',
        roles: ['admin'],
      },
    ]);

    await signInPromise;

    expect(service.currentUserValue).toEqual({
      id: '1',
      name: 'Alex Smith',
      tenantId: 'north-america',
      roles: ['admin'],
    });
  });

  it('should fall back to local defaults when backend record omits fields', async () => {
    const findApiUserSpy = spyOn<any>(service, 'findApiUserByLoginId').and.resolveTo({
      id: undefined,
      name: undefined,
      tenantId: undefined,
      roles: [],
    });

    await (service as any).setLocalUser({ username: '   ', password: 'any', tenantId: ' ' });

    expect(findApiUserSpy).toHaveBeenCalledWith('', 'any');

    expect(service.currentUserValue).toEqual({
      id: 'local-user',
      name: 'Local User',
      tenantId: 'tenant-a',
      roles: ['customer'],
    });
  });
});

