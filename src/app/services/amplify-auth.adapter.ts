import { Injectable } from '@angular/core';
import {
  fetchUserAttributes,
  getCurrentUser,
  signIn,
  signOut,
} from 'aws-amplify/auth';

export interface AmplifySignInInput {
  username: string;
  password: string;
}

export interface AmplifySignInResult {
  nextStep: {
    signInStep: string;
  };
}

export interface AmplifyCurrentUser {
  userId: string;
  username: string;
}

export type AmplifyUserAttributes = Record<string, string>;

@Injectable({ providedIn: 'root' })
export class AmplifyAuthAdapter {
  signIn(input: AmplifySignInInput): Promise<AmplifySignInResult> {
    return signIn(input) as Promise<AmplifySignInResult>;
  }

  signOut(): Promise<void> {
    return signOut();
  }

  getCurrentUser(): Promise<AmplifyCurrentUser> {
    return getCurrentUser() as Promise<AmplifyCurrentUser>;
  }

  fetchUserAttributes(): Promise<AmplifyUserAttributes> {
    return fetchUserAttributes() as Promise<AmplifyUserAttributes>;
  }
}