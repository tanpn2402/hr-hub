export interface AuthenticatedUser {
  id: string;
  username?: string;
  email?: string;
  roles: string[];
  permissions: string[];
  provider: string;
  providerUserId: string;
}

export interface BearerCredentials {
  type: 'bearer';
  token: string;
}

export type AuthCredentials = BearerCredentials;
