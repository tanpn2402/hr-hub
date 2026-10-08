import { Module } from '@nestjs/common';
import { TraceModule } from '../app/trace/trace.module';
import { AuthModule } from '../auth/auth.module';
import { ArchiveExtractorService } from './archive-extractor.service';
import { WebAppAccessRequestService } from './web-app-access-request.service';
import { WebAppAccessService } from './web-app-access.service';
import { WebAppDataService } from './web-app-data.service';
import { WebAppRuntimeController } from './web-app-runtime.controller';
import { WebAppStorageService } from './web-app-storage.service';
import { WebAppStaticController } from './web-app-static.controller';
import { OptionalAuthGuard } from './web-apps-optional-auth.guard';
import { WebAppsAdminController } from './web-apps-admin.controller';
import { WebAppsAdminGuard } from './web-apps-admin.guard';
import { WebAppsConfig } from './web-apps.config';
import { WebAppsService } from './web-apps.service';

@Module({
  imports: [AuthModule, TraceModule],
  // Runtime controller first so its routes are matched before the admin ":id" routes.
  controllers: [WebAppRuntimeController, WebAppsAdminController, WebAppStaticController],
  providers: [
    WebAppsConfig,
    WebAppStorageService,
    ArchiveExtractorService,
    WebAppDataService,
    WebAppAccessService,
    WebAppAccessRequestService,
    WebAppsAdminGuard,
    OptionalAuthGuard,
    WebAppsService,
  ],
})
export class WebAppsModule {}
