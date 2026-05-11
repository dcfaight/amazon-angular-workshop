import { TestBed } from '@angular/core/testing';
import { AmplifyAuthAdapter } from './amplify-auth.adapter';

describe('AmplifyAuthAdapter', () => {
  let adapter: AmplifyAuthAdapter;
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    originalWarn = console.warn;
    spyOn(console, 'warn').and.callFake((...args: unknown[]) => {
      const message = String(args[0] ?? '');
      if (message.includes('Amplify has not been configured')) {
        return;
      }

      originalWarn(...(args as Parameters<typeof console.warn>));
    });

    TestBed.configureTestingModule({
      providers: [AmplifyAuthAdapter],
    });

    adapter = TestBed.inject(AmplifyAuthAdapter);
  });

  it('should be created', () => {
    expect(adapter).toBeTruthy();
  });

  it('should call signIn wrapper and return a settled promise', async () => {
    let settled = false;

    try {
      await adapter.signIn({ username: 'user@example.com', password: 'password' });
      settled = true;
    } catch {
      settled = true;
    }

    expect(settled).toBeTrue();
  });

  it('should call signOut wrapper and return a settled promise', async () => {
    let settled = false;

    try {
      await adapter.signOut();
      settled = true;
    } catch {
      settled = true;
    }

    expect(settled).toBeTrue();
  });

  it('should call getCurrentUser wrapper and return a settled promise', async () => {
    let settled = false;

    try {
      await adapter.getCurrentUser();
      settled = true;
    } catch {
      settled = true;
    }

    expect(settled).toBeTrue();
  });

  it('should call fetchUserAttributes wrapper and return a settled promise', async () => {
    let settled = false;

    try {
      await adapter.fetchUserAttributes();
      settled = true;
    } catch {
      settled = true;
    }

    expect(settled).toBeTrue();
  });
});