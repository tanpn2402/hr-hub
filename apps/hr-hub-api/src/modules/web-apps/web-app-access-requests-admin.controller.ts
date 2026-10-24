import { BadRequestException, Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { WebAppAccessRequestService } from './web-app-access-request.service';
import { WebAppsAdminGuard } from './web-apps-admin.guard';

@Controller('web-apps/access-requests')
@UseGuards(AuthGuard, WebAppsAdminGuard)
export class WebAppAccessRequestsAdminController {
  constructor(private readonly requests: WebAppAccessRequestService) {}

  @Get()
  list() {
    return this.requests.listAll();
  }

  @Patch(':id')
  decide(
    @Param('id') id: string,
    @Body() body: { decision?: unknown; note?: unknown } | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const decision = body?.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      throw new BadRequestException('decision must be approved or rejected');
    }
    if (body?.note !== undefined && typeof body.note !== 'string') {
      throw new BadRequestException('note must be a string');
    }

    return this.requests.decide(id, decision, user, body?.note);
  }
}
