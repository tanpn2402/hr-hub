import { BadRequestException, Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { WebAppAccessService } from './web-app-access.service';
import { OptionalAuthGuard } from './web-apps-optional-auth.guard';
import { WebAppDataService } from './web-app-data.service';
import { WebAppsService } from './web-apps.service';

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
  ) {}

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
  ) {
    await this.access.assertAccess(slug, user ?? null);
    if (!body || typeof body !== 'object' || !('value' in body)) {
      throw new BadRequestException('Body must be { "value": <json>, "ifUpdatedAt"?: number }');
    }
    if (body.ifUpdatedAt !== undefined && !Number.isInteger(body.ifUpdatedAt)) {
      throw new BadRequestException('ifUpdatedAt must be an integer');
    }
    return this.data.put(slug, key, body.value, body.ifUpdatedAt);
  }

  @Delete(':slug/data/:key')
  @UseGuards(OptionalAuthGuard)
  async delete(@Param('slug') slug: string, @Param('key') key: string, @CurrentUser() user: AuthenticatedUser | undefined) {
    await this.access.assertAccess(slug, user ?? null);
    return this.data.delete(slug, key);
  }
}
