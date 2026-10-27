import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TraceContextService } from '../app/trace/trace-context.service';
import { TraceLogger } from '../app/trace/trace-logger.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { parseRequiredRoles, WebAppAccessService } from './web-app-access.service';
import { userLabel } from './web-apps-actor';

export type AccessRequestStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type AccessRequestDecision = 'approved' | 'rejected';

export type WebAppAccessRequestRecord = {
  id: string;
  webAppId: string;
  appSlug: string;
  appName: string;
  requesterId: string;
  requesterUsername: string | null;
  requesterEmail: string | null;
  message: string;
  requiredRoles: string[];
  status: AccessRequestStatus;
  requestedAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  decidedByName: string | null;
  note: string | null;
};

/**
 * Access requests are stored in the HR Hub database. Approval records the decision only; app access
 * continues to be controlled by the app's required Idenplane roles.
 */
@Injectable()
export class WebAppAccessRequestService {
  private readonly logger: TraceLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WebAppAccessService,
    traceContext: TraceContextService,
  ) {
    this.logger = new TraceLogger(traceContext, WebAppAccessRequestService.name);
  }

  async status(slug: string, user: AuthenticatedUser) {
    const record = await this.prisma.webAppAccessRequest.findUnique({
      where: { appSlug_requesterId: { appSlug: slug, requesterId: user.id } },
    });

    return {
      status: (record?.status ?? 'none') as AccessRequestStatus,
      requestedAt: record?.requestedAt?.toISOString() ?? null,
      decidedAt: record?.decidedAt?.toISOString() ?? null,
      note: record?.note ?? null,
    };
  }

  async create(slug: string, user: AuthenticatedUser, message: unknown) {
    const app = await this.prisma.webApp.findUnique({ where: { slug } });
    if (!app || app.status !== 'published' || !this.access.canSee(user, app)) throw new NotFoundException('Web app not found');

    const requiredRoles = parseRequiredRoles(app.requiredRoles);
    if (this.access.canUse(user, requiredRoles)) {
      throw new ConflictException('You already have access to this web app');
    }

    const current = await this.status(slug, user);
    if (current.status === 'pending') return current;

    const text = typeof message === 'string' ? message.trim().slice(0, 500) : '';
    const requestedAt = new Date();
    const record = await this.prisma.webAppAccessRequest.upsert({
      where: { appSlug_requesterId: { appSlug: app.slug, requesterId: user.id } },
      create: {
        webAppId: app.id,
        appSlug: app.slug,
        appName: app.name,
        requesterId: user.id,
        requesterUsername: user.username ?? null,
        requesterEmail: user.email ?? null,
        message: text,
        requiredRoles: JSON.stringify(requiredRoles),
        status: 'pending',
        requestedAt,
      },
      update: {
        webAppId: app.id,
        appName: app.name,
        requesterUsername: user.username ?? null,
        requesterEmail: user.email ?? null,
        message: text,
        requiredRoles: JSON.stringify(requiredRoles),
        status: 'pending',
        requestedAt,
        decidedAt: null,
        decidedBy: null,
        decidedByName: null,
        note: null,
      },
    });

    this.logger.log(`Access request for ${slug} by ${userLabel(user)} (previous status: ${current.status})`);
    return {
      status: 'pending' as const,
      requestedAt: record.requestedAt.toISOString(),
      decidedAt: null,
      note: null,
    };
  }

  async listAll(): Promise<WebAppAccessRequestRecord[]> {
    const records = await this.prisma.webAppAccessRequest.findMany({
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    });

    return records.map((record) => this.formatRecord(record));
  }

  async decide(id: string, decision: AccessRequestDecision, user: AuthenticatedUser, note: unknown) {
    const existing = await this.prisma.webAppAccessRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Access request not found');
    if (existing.status !== 'pending') throw new ConflictException('Access request has already been decided');

    const text = typeof note === 'string' ? note.trim().slice(0, 500) : '';
    const updated = await this.prisma.webAppAccessRequest.updateMany({
      where: { id, status: 'pending' },
      data: {
        status: decision,
        decidedAt: new Date(),
        decidedBy: user.id,
        decidedByName: userLabel(user),
        note: text || null,
      },
    });
    if (updated.count === 0) throw new ConflictException('Access request has already been decided');

    const record = await this.prisma.webAppAccessRequest.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Access request not found');

    this.logger.log(`Access request ${id} ${decision} by ${userLabel(user)}`);
    return this.formatRecord(record);
  }

  private formatRecord(record: {
    id: string;
    webAppId: string;
    appSlug: string;
    appName: string;
    requesterId: string;
    requesterUsername: string | null;
    requesterEmail: string | null;
    message: string;
    requiredRoles: string;
    status: string;
    requestedAt: Date;
    decidedAt: Date | null;
    decidedBy: string | null;
    decidedByName: string | null;
    note: string | null;
  }): WebAppAccessRequestRecord {
    return {
      id: record.id,
      webAppId: record.webAppId,
      appSlug: record.appSlug,
      appName: record.appName,
      requesterId: record.requesterId,
      requesterUsername: record.requesterUsername,
      requesterEmail: record.requesterEmail,
      message: record.message,
      requiredRoles: parseRequiredRoles(record.requiredRoles),
      status: record.status as AccessRequestStatus,
      requestedAt: record.requestedAt,
      decidedAt: record.decidedAt,
      decidedBy: record.decidedBy,
      decidedByName: record.decidedByName,
      note: record.note,
    };
  }
}
