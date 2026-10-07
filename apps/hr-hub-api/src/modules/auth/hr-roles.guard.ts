import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthenticatedUser } from './auth.types';

/**
 * Restricts an endpoint to HR Hub staff: the user needs at least one of HRHUB_ALLOWED_ROLES (default "HR,ADMIN",
 * case-insensitive). Must run after AuthGuard:  @UseGuards(AuthGuard, HrRolesGuard)
 */
@Injectable()
export class HrRolesGuard implements CanActivate {
  private readonly allowed: string[];

  constructor(config: ConfigService) {
    this.allowed = config
      .get<string>('HRHUB_ALLOWED_ROLES', 'HR,ADMIN')
      .split(',')
      .map((role) => role.trim().toLowerCase())
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    const user = (context.switchToHttp().getRequest<Request>() as Request & { user?: AuthenticatedUser }).user;

    if (!user || !user.roles.some((role) => this.allowed.includes(role.toLowerCase()))) {
      throw new ForbiddenException('HR or admin role required');
    }

    return true;
  }
}
