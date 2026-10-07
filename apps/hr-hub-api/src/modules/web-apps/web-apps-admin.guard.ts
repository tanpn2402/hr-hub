import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth.types';
import { WebAppsConfig } from './web-apps.config';

/** Must run after AuthGuard. Requires at least one of WEBAPPS_ADMIN_ROLES. */
@Injectable()
export class WebAppsAdminGuard implements CanActivate {
  constructor(private readonly config: WebAppsConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const user = (context.switchToHttp().getRequest<Request>() as Request & { user?: AuthenticatedUser }).user;

    if (!user || !user.roles.some((role) => this.config.adminRoles.includes(role))) {
      throw new ForbiddenException('Web app administration requires an admin role');
    }

    return true;
  }
}
