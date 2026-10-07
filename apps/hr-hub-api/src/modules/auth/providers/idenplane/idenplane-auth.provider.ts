import { Injectable } from '@nestjs/common';
import { AuthProvider } from '../../auth-provider';
import { AuthCredentials, AuthenticatedUser } from '../../auth.types';
import { IdenplaneClient } from './idenplane.client';
import { IdenplaneTokenIntrospection } from './idenplane.types';

@Injectable()
export class IdenplaneAuthProvider implements AuthProvider {
  /** Short-lived cache so chatty callers (web app data API) don't introspect on every request. */
  private readonly cache = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 30_000;
  private static readonly CACHE_MAX = 500;

  constructor(private readonly idenplane: IdenplaneClient) {}

  async authenticate(credentials: AuthCredentials): Promise<AuthenticatedUser | null> {
    if (credentials.type !== 'bearer') {
      return null;
    }

    const cached = this.cache.get(credentials.token);
    if (cached && cached.expiresAt > Date.now()) return cached.user;
    this.cache.delete(credentials.token);

    const introspection = await this.idenplane.introspect(credentials.token);
    if (!introspection?.active || !introspection.sub) return null;

    const user = this.toAuthenticatedUser(introspection);
    if (this.cache.size >= IdenplaneAuthProvider.CACHE_MAX) this.cache.clear();
    this.cache.set(credentials.token, { user, expiresAt: Date.now() + IdenplaneAuthProvider.CACHE_TTL_MS });
    return user;
  }

  private toAuthenticatedUser(user: IdenplaneTokenIntrospection): AuthenticatedUser {
    return {
      id: user.sub as string,
      username: user.username ?? user.preferred_username,
      email: user.email,
      roles: this.getRoles(user),
      permissions: this.getPermissions(user),
      provider: 'idenplane',
      providerUserId: user.sub as string,
    };
  }

  private getRoles(user: IdenplaneTokenIntrospection): string[] {
    const resourceRoles = Object.values(user.resource_access ?? {}).flatMap((resource) => resource.roles ?? []);

    return [...new Set([...(user.realm_access?.roles ?? []), ...resourceRoles])];
  }

  private getPermissions(user: IdenplaneTokenIntrospection): string[] {
    return user.scope?.split(' ').filter(Boolean) ?? [];
  }
}
