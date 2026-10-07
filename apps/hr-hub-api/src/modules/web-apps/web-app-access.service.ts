import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { WebAppsConfig } from './web-apps.config';

export function parseRequiredRoles(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((role): role is string => typeof role === 'string') : [];
  } catch {
    return [];
  }
}

/** Server-side authorization for web app runtime access. The slug always comes from the route. */
@Injectable()
export class WebAppAccessService {
  private readonly logger: TraceLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: WebAppsConfig,
    traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, WebAppAccessService.name);
  }

  isAdmin(user: { roles: string[] }): boolean {
    return user.roles.some((role) => this.config.adminRoles.includes(role));
  }

  /** requiredRoles = [] -> any authenticated user; otherwise at least one of the roles (OR). */
  canUse(user: { roles: string[] }, requiredRoles: string[]): boolean {
    return requiredRoles.length === 0 || this.isAdmin(user) || user.roles.some((role) => requiredRoles.includes(role));
  }

  /** `user` is null for anonymous callers: allowed for public apps, 401 (log in) for restricted ones. */
  async assertAccess(slug: string, user: AuthenticatedUser | null) {
    const app = await this.prisma.webApp.findUnique({ where: { slug } });
    if (!app || app.status === 'deleted') {
      this.logger.warn(`Access denied: web app ${slug} not found`);
      throw new NotFoundException('Web app not found');
    }

    const requiredRoles = parseRequiredRoles(app.requiredRoles);
    const admin = user ? this.isAdmin(user) : false;

    if (app.status === 'disabled') {
      this.logger.warn(`Access denied: web app ${slug} is disabled (user ${user?.id ?? 'anonymous'})`);
      throw new ForbiddenException('Web app is disabled');
    }
    if (app.status !== 'published' && !admin) {
      this.logger.warn(`Access denied: web app ${slug} is ${app.status} (user ${user?.id ?? 'anonymous'})`);
      throw new NotFoundException('Web app not found');
    }

    if (!user) {
      if (requiredRoles.length > 0) {
        this.logger.warn(`Access denied: web app ${slug} requires login (anonymous caller)`);
        throw new UnauthorizedException();
      }
      this.logger.debug(`Anonymous access granted to public web app ${slug}`);
      return app;
    }

    if (!this.canUse(user, requiredRoles)) {
      this.logger.warn(
        `Access denied: user ${user.id} [${user.roles.join(',')}] lacks any of [${requiredRoles.join(',')}] for web app ${slug}`,
      );
      throw new ForbiddenException('You do not have access to this web app');
    }

    this.logger.debug(`Access granted: user ${user.id} to web app ${slug}`);
    return app;
  }

  async listAccessible(user: { roles: string[] }) {
    const apps = await this.prisma.webApp.findMany({ where: { status: 'published' }, orderBy: { name: 'asc' } });
    return apps.filter((app) => this.canUse(user, parseRequiredRoles(app.requiredRoles)));
  }
}
