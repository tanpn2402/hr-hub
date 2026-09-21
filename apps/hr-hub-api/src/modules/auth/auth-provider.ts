import { AuthCredentials, AuthenticatedUser } from './auth.types';

export interface AuthProvider {
  authenticate(credentials: AuthCredentials): Promise<AuthenticatedUser | null>;
}

export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');
