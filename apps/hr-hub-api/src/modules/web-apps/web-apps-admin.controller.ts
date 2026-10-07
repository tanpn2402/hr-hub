import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { WebAppsAdminGuard } from './web-apps-admin.guard';
import { UPLOAD_HARD_LIMIT_BYTES } from './web-apps.config';
import { WebAppsService } from './web-apps.service';
import { CreateWebAppInput, UpdateWebAppInput, UploadedArchive, UploadVersionInput } from './web-apps.types';

/** Archives are streamed to disk (never buffered in memory). Resolved lazily so .env is already loaded. */
const archiveUpload = FileInterceptor('file', {
  limits: { fileSize: UPLOAD_HARD_LIMIT_BYTES, files: 1 },
  storage: diskStorage({
    destination: (_request, _file, callback) => {
      const dir = join(resolve(process.env.WEBAPPS_ROOT ?? './data/webapps'), '.tmp', 'uploads');
      mkdirSync(dir, { recursive: true });
      callback(null, dir);
    },
    filename: (_request, _file, callback) => callback(null, randomUUID()),
  }),
});

@Controller('web-apps')
@UseGuards(AuthGuard, WebAppsAdminGuard)
export class WebAppsAdminController {
  constructor(private readonly webApps: WebAppsService) {}

  @Post()
  @UseInterceptors(archiveUpload)
  create(@Body() body: CreateWebAppInput, @UploadedFile() file: UploadedArchive | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.webApps.create(body ?? {}, file, user);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.webApps.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateWebAppInput) {
    return this.webApps.update(id, body ?? {});
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.webApps.remove(id);
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string) {
    return this.webApps.listVersions(id);
  }

  @Post(':id/versions')
  @UseInterceptors(archiveUpload)
  uploadVersion(
    @Param('id') id: string,
    @Body() body: UploadVersionInput,
    @UploadedFile() file: UploadedArchive | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.webApps.uploadVersion(id, file, body ?? {}, user);
  }

  @Get(':id/versions/:version')
  getVersion(@Param('id') id: string, @Param('version', ParseIntPipe) version: number) {
    return this.webApps.getVersion(id, version);
  }

  @Post(':id/versions/:version/publish')
  publish(@Param('id') id: string, @Param('version', ParseIntPipe) version: number) {
    return this.webApps.publish(id, version);
  }

  @Post(':id/versions/:version/rollback')
  rollback(@Param('id') id: string, @Param('version', ParseIntPipe) version: number) {
    return this.webApps.rollback(id, version);
  }

  @Post(':id/disable')
  disable(@Param('id') id: string) {
    return this.webApps.disable(id);
  }

  @Post(':id/enable')
  enable(@Param('id') id: string) {
    return this.webApps.enable(id);
  }
}
