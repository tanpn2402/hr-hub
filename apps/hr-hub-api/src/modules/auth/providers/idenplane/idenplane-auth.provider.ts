import { Injectable } from '@nestjs/common';
import { AuthProvider } from '../../auth-provider';
import { AuthCredentials, AuthenticatedUser } from '../../auth.types';
import { IdenplaneClient } from './idenplane.client';
import { IdenplaneTokenIntrospection } from './idenplane.types';

@Injectable()
export class IdenplaneAuthProvider implements AuthProvider {
  constructor(private readonly idenplane: IdenplaneClient) {}

  async authenticate(credentials: AuthCredentials): Promise<AuthenticatedUser | null> {
    if (credentials.type !== 'bearer') {
      return null;
    }

    const user = await this.idenplane.introspect(credentials.token);
    return user?.active && user.sub ? this.toAuthenticatedUser(user) : null;
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
    const resourceRoles = Object.values(user.resource_access ?? {}).flatMap(
      (resource) => resource.roles ?? [],
    );

    return [...new Set([...(user.realm_access?.roles ?? []), ...resourceRoles])];
  }

  private getPermissions(user: IdenplaneTokenIntrospection): string[] {
    return user.scope?.split(' ').filter(Boolean) ?? [];
  }
}
