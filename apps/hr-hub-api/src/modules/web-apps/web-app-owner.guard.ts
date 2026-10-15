import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../auth/auth.types';
import { WebAppsService } from './web-apps.service';

/** Must run after AuthGuard. Routes with an :id answer 404 for private ("only me") apps of other users. */
@Injectable()
export class WebAppOwnerGuard implements CanActivate {
  constructor(private readonly webApps: WebAppsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const id = request.params?.id;
    if (typeof id === 'string' && request.user) await this.webApps.assertManageable(id, request.user);
    return true;
  }
}
