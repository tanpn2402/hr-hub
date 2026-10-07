import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { AuthenticatedUser } from '../auth/auth.types';

/**
 * Authenticates when a Bearer token is present, but never rejects. A missing or invalid token simply leaves
 * `request.user` unset, i.e. an anonymous caller who can only see public resources.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const match = /^Bearer (.+)$/.exec(request.headers.authorization ?? '');

    if (match) {
      try {
        request.user = await this.authService.authenticate({ type: 'bearer', token: match[1] });
      } catch {
        // Invalid/expired token: treat as anonymous.
      }
    }

    return true;
  }
}
