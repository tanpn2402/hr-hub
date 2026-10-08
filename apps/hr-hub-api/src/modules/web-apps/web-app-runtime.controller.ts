import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { WebAppAccessRequestService } from './web-app-access-request.service';
import { WebAppAccessService } from './web-app-access.service';
import { OptionalAuthGuard } from './web-apps-optional-auth.guard';
import { WebAppDataService } from './web-app-data.service';
import { WebAppsService } from './web-apps.service';
import { DataActor, deviceId, userLabel } from './web-apps-actor';

/**
 * Runtime API used by web apps (through the viewer/SDK). The web app is always derived from the :slug
 * route segment and checked against its required roles on every call.
 */
@Controller('web-apps')
export class WebAppRuntimeController {
  constructor(
    private readonly access: WebAppAccessService,
    private readonly data: WebAppDataService,
    private readonly webApps: WebAppsService,
    private readonly requests: WebAppAccessRequestService,
  ) {}

  /** Who is writing and from which device (the client IP the API sees, forwarded by nginx). */
  private actorOf(user: AuthenticatedUser | undefined, request: Request): DataActor {
    return {
      by: userLabel(user),
      device: deviceId(request),
      isAdmin: user ? this.access.isAdmin(user) : false,
    };
  }

  /**
   * Web apps for the caller: everything for admins, otherwise published apps their roles allow.
   * Anonymous callers see only public apps (no required roles).
   */
  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@CurrentUser() user: AuthenticatedUser | undefined) {
    return this.webApps.listFor(user ?? null);
  }

  /** Anonymous callers may open public apps; restricted apps answer 401 so the client can send them to login. */
  @Get(':slug/access')
  @UseGuards(OptionalAuthGuard)
  async checkAccess(@Param('slug') slug: string, @CurrentUser() user: AuthenticatedUser | undefined) {
    const app = await this.access.assertAccess(slug, user ?? null);
    return { slug: app.slug, name: app.name, description: app.description, status: app.status };
  }

  @Get(':slug/data')
  @UseGuards(OptionalAuthGuard)
  async listData(@Param('slug') slug: string, @CurrentUser() user: AuthenticatedUser | undefined) {
    await this.access.assertAccess(slug, user ?? null);
    return this.data.list(slug);
  }

  @Get(':slug/data/:key')
  @UseGuards(OptionalAuthGuard)
  async get(@Param('slug') slug: string, @Param('key') key: string, @CurrentUser() user: AuthenticatedUser | undefined) {
    await this.access.assertAccess(slug, user ?? null);
    return this.data.get(slug, key);
  }

  @Put(':slug/data/:key')
  @UseGuards(OptionalAuthGuard)
  async put(
    @Param('slug') slug: string,
    @Param('key') key: string,
    @Body() body: { value?: unknown; ifUpdatedAt?: number },
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Req() request: Request,
  ) {
    await this.access.assertAccess(slug, user ?? null);
    if (!body || typeof body !== 'object' || !('value' in body)) {
      throw new BadRequestException('Body must be { "value": <json>, "ifUpdatedAt"?: number }');
    }
    if (body.ifUpdatedAt !== undefined && !Number.isInteger(body.ifUpdatedAt)) {
      throw new BadRequestException('ifUpdatedAt must be an integer');
    }
    return this.data.put(slug, key, body.value, body.ifUpdatedAt, this.actorOf(user, request));
  }

  @Delete(':slug/data/:key')
  @UseGuards(OptionalAuthGuard)
  async delete(
    @Param('slug') slug: string,
    @Param('key') key: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Req() request: Request,
  ) {
    await this.access.assertAccess(slug, user ?? null);
    return this.data.delete(slug, key, this.actorOf(user, request));
  }

  /** Status of the caller's request for access to this app: none / pending / approved / rejected. */
  @Get(':slug/access-request')
  @UseGuards(AuthGuard)
  accessRequestStatus(@Param('slug') slug: string, @CurrentUser() user: AuthenticatedUser) {
    return this.requests.status(slug, user);
  }

  /** Ask administrators for access (written into the manage-app-accesses app). */
  @Post(':slug/access-request')
  @UseGuards(AuthGuard)
  requestAccess(
    @Param('slug') slug: string,
    @Body() body: { message?: string } | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.requests.create(slug, user, body?.message, deviceId(request));
  }
}
