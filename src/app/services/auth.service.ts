import { Inject, Injectable, Optional, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { User } from '../models/user';
import { environment } from '../../environments/environment';
import { AmplifyAuthAdapter } from './amplify-auth.adapter';

interface SignInInput {
  username: string;
  password: string;
  tenantId?: string;
}

interface ApiUserRecord {
  id?: string | number;
  username?: string;
  email?: string;
  name?: string;
  tenantId?: string;
  roles?: string[];
  password?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'currentUser';
  private readonly useAmplifyAuth = environment.features.useAmplifyAuth;
  private readonly usersApiUrl = 'http://192.168.1.5:3000/users';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private amplifyAuth: AmplifyAuthAdapter,
    @Optional() private http: HttpClient | null
  ) {}

  async initializeAuthState(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const saved = localStorage.getItem(this.storageKey);

    if (this.useAmplifyAuth) {
      await this.restoreAmplifyUser(saved ? (JSON.parse(saved) as User) : null);
      return;
    }

    this.currentUserSubject.next(saved ? (JSON.parse(saved) as User) : null);
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  async signIn(input: SignInInput): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Sign-in is only available in the browser.');
    }

    if (this.useAmplifyAuth) {
      try {
        const result = await this.amplifyAuth.signIn({
          username: input.username,
          password: input.password,
        });
        if (result.nextStep.signInStep !== 'DONE') {
          throw new Error('Additional sign-in steps are required by Cognito.');
        }

        await this.restoreAmplifyUser(null);
        return;
      } catch {
        await this.setLocalUser(input);
        return;
      }
    }

    await this.setLocalUser(input);
  }

  async signOut(): Promise<void> {
    if (this.useAmplifyAuth && isPlatformBrowser(this.platformId)) {
      try {
        await this.amplifyAuth.signOut();
      } catch {
        // Fall through to local cleanup when Amplify is unavailable.
      }
    }

    this.currentUserSubject.next(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.storageKey);
    }
  }

  private async restoreAmplifyUser(cachedUser: User | null): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const current = await this.amplifyAuth.getCurrentUser();
      const attributes = await this.amplifyAuth.fetchUserAttributes();

      const user: User = {
        id: current.userId,
        name: attributes['name'] || current.username,
        tenantId: attributes['custom:tenantId'] || 'tenant-a',
        roles: attributes['custom:roles'] ? attributes['custom:roles'].split(',') : ['customer'],
      };

      this.currentUserSubject.next(user);
      localStorage.setItem(this.storageKey, JSON.stringify(user));
    } catch {
      this.currentUserSubject.next(cachedUser);
      if (cachedUser) {
        localStorage.setItem(this.storageKey, JSON.stringify(cachedUser));
        return;
      }

      localStorage.removeItem(this.storageKey);
    }
  }

  private async setLocalUser(input: SignInInput): Promise<void> {
    const tenantId = input.tenantId?.trim() || 'tenant-a';
    const loginId = input.username.trim();
    const apiUser = await this.findApiUserByLoginId(loginId, input.password);

    if (apiUser) {
      const user: User = {
        id: String(apiUser.id ?? (loginId.toLowerCase() || 'local-user')),
        name: apiUser.name?.trim() || loginId || 'Local User',
        tenantId: apiUser.tenantId?.trim() || tenantId,
        roles: Array.isArray(apiUser.roles) && apiUser.roles.length ? apiUser.roles : ['customer'],
      };

      this.currentUserSubject.next(user);
      localStorage.setItem(this.storageKey, JSON.stringify(user));
      return;
    }

    const user: User = {
      id: loginId.toLowerCase() || 'local-user',
      name: loginId || 'Local User',
      tenantId,
      roles: ['customer'],
    };

    this.currentUserSubject.next(user);
    localStorage.setItem(this.storageKey, JSON.stringify(user));
  }

  private async findApiUserByLoginId(loginId: string, password: string): Promise<ApiUserRecord | null> {
    if (!loginId || !this.http) {
      return null;
    }

    try {
      let users = await firstValueFrom(
        this.http.get<ApiUserRecord[]>(`${this.usersApiUrl}?username=${encodeURIComponent(loginId)}`)
      );

      // db.json users often have email but no username.
      if ((!Array.isArray(users) || !users.length) && loginId.includes('@')) {
        users = await firstValueFrom(
          this.http.get<ApiUserRecord[]>(`${this.usersApiUrl}?email=${encodeURIComponent(loginId)}`)
        );
      }

      // Allow sign-in by full display name when username/email are unavailable.
      if (!Array.isArray(users) || !users.length) {
        users = await firstValueFrom(
          this.http.get<ApiUserRecord[]>(`${this.usersApiUrl}?name=${encodeURIComponent(loginId)}`)
        );
      }

      if (!Array.isArray(users) || !users.length) {
        return null;
      }

      const normalizedLoginId = loginId.toLowerCase();
      const exactMatch =
        users.find((u) => u.username?.toLowerCase() === normalizedLoginId) ??
        users.find((u) => u.email?.toLowerCase() === normalizedLoginId) ??
        users[0];

      if (exactMatch?.password && exactMatch.password !== password) {
        return null;
      }

      return exactMatch;
    } catch {
      return null;
    }
  }
}
