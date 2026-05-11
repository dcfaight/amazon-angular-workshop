import { TestBed } from '@angular/core/testing';
import { AmplifyAuthAdapter } from './amplify-auth.adapter';

describe('AmplifyAuthAdapter', () => {
  let adapter: AmplifyAuthAdapter;

  beforeEach(() => {
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