import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_PROVIDER, AuthProvider } from './auth-provider';
import { AuthCredentials, AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(@Inject(AUTH_PROVIDER) private readonly provider: AuthProvider) {}

  async authenticate(credentials: AuthCredentials): Promise<AuthenticatedUser> {
    const user = await this.provider.authenticate(credentials);

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
