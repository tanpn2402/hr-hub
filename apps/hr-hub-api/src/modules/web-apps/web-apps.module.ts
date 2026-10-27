import { Module } from '@nestjs/common';
import { TraceModule } from '../app/trace/trace.module';
import { AuthModule } from '../auth/auth.module';
import { ArchiveExtractorService } from './archive-extractor.service';
import { WebAppAccessRequestService } from './web-app-access-request.service';
import { WebAppAccessRequestsAdminController } from './web-app-access-requests-admin.controller';
import { WebAppAccessService } from './web-app-access.service';
import { WebAppOwnerGuard } from './web-app-owner.guard';
import { WebAppDataService } from './web-app-data.service';
import { WebAppManifestService } from './web-app-manifest.service';
import { WebAppRealtimeGateway } from './web-app-realtime.gateway';
import { WebAppRealtimeService } from './web-app-realtime.service';
import { WebAppSettingsService } from './web-app-settings.service';
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
  controllers: [WebAppRuntimeController, WebAppAccessRequestsAdminController, WebAppsAdminController, WebAppStaticController],
  providers: [
    WebAppsConfig,
    WebAppStorageService,
    ArchiveExtractorService,
    WebAppDataService,
    WebAppAccessService,
    WebAppAccessRequestService,
    WebAppsAdminGuard,
    WebAppOwnerGuard,
    OptionalAuthGuard,
    WebAppsService,
    WebAppManifestService,
    WebAppSettingsService,
    WebAppRealtimeService,
    WebAppRealtimeGateway,
  ],
})
export class WebAppsModule {}
