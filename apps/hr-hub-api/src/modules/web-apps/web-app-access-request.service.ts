import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { parseRequiredRoles, WebAppAccessService } from './web-app-access.service';
import { WebAppDataService } from './web-app-data.service';
import { ACCESS_REQUESTS_SLUG, accessRequestKey } from './web-apps.config';
import { DataActor, userLabel } from './web-apps-actor';

export type AccessRequestStatus = 'none' | 'pending' | 'approved' | 'rejected';

interface AccessRequestRecord {
  status?: AccessRequestStatus;
  requestedAt?: string;
  decidedAt?: string | null;
  note?: string | null;
}

/**
 * "Request access" for users who are signed in but lack the roles of a web app. The request is written into the
 * data of the manage-app-accesses web app (server-side, so requesters need no access to that app) to let the
 * administrators know who is asking. It does NOT affect role checking: roles are granted in Idenplane, and the
 * administrators use that app to keep track of which requests they handled.
 */
@Injectable()
export class WebAppAccessRequestService {
  private readonly logger: TraceLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WebAppAccessService,
    private readonly data: WebAppDataService,
    traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, WebAppAccessRequestService.name);
  }

  status(slug: string, user: AuthenticatedUser) {
    const record = this.data.peek(ACCESS_REQUESTS_SLUG, accessRequestKey(slug, user.id)) as AccessRequestRecord | null;
    return {
      status: (record?.status ?? 'none') as AccessRequestStatus,
      requestedAt: record?.requestedAt ?? null,
      decidedAt: record?.decidedAt ?? null,
      note: record?.note ?? null,
    };
  }

  async create(slug: string, user: AuthenticatedUser, message: unknown, device: string | null) {
    if (slug === ACCESS_REQUESTS_SLUG) throw new BadRequestException('This app cannot be requested');

    const app = await this.prisma.webApp.findUnique({ where: { slug } });
    if (!app || app.status !== 'published') throw new NotFoundException('Web app not found');

    const requiredRoles = parseRequiredRoles(app.requiredRoles);
    if (this.access.canUse(user, requiredRoles)) {
      throw new ConflictException('You already have access to this web app');
    }

    const holder = await this.prisma.webApp.findUnique({ where: { slug: ACCESS_REQUESTS_SLUG } });
    if (!holder || holder.status === 'deleted') {
      this.logger.error(`Access request rejected: web app ${ACCESS_REQUESTS_SLUG} is not set up`);
      throw new ServiceUnavailableException('Access requests are not set up yet. Please contact an administrator.');
    }

    const key = accessRequestKey(slug, user.id);
    const current = this.status(slug, user);
    if (current.status === 'pending') return current;

    const text = typeof message === 'string' ? message.trim().slice(0, 500) : '';
    const requestedAt = new Date().toISOString();
    const actor: DataActor = { by: userLabel(user), device, isAdmin: false };

    this.data.put(
      ACCESS_REQUESTS_SLUG,
      key,
      {
        type: 'access-request',
        appSlug: app.slug,
        appName: app.name,
        requiredRoles,
        user: { id: user.id, username: user.username ?? null, email: user.email ?? null },
        message: text,
        status: 'pending',
        requestedAt,
        decidedAt: null,
        decidedBy: null,
        note: null,
      },
      undefined,
      actor,
    );

    this.logger.log(`Access request for ${slug} by ${actor.by} (previous status: ${current.status})`);
    return { status: 'pending' as const, requestedAt, decidedAt: null, note: null };
  }
}
