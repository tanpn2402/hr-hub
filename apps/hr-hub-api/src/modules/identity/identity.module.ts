import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IdenplaneModule } from '../integrations/idenplane/idenplane.module';
import { IdentityRolesController } from './identity-roles.controller';
import { IDENTITY_ROLES_PROVIDER } from './identity-roles.provider';
import { IdenplaneRolesProvider } from './providers/idenplane/idenplane-roles.provider';
import { IdentityUsersController } from './identity-users.controller';
import { IDENTITY_USERS_PROVIDER } from './identity-users.provider';
import { IdenplaneUsersProvider } from './providers/idenplane/idenplane-users.provider';

@Module({
  imports: [AuthModule, IdenplaneModule],
  controllers: [IdentityUsersController, IdentityRolesController],
  providers: [
    IdenplaneUsersProvider,
    IdenplaneRolesProvider,
    {
      provide: IDENTITY_USERS_PROVIDER,
      useExisting: IdenplaneUsersProvider,
    },
    {
      provide: IDENTITY_ROLES_PROVIDER,
      useExisting: IdenplaneRolesProvider,
    },
  ],
  exports: [IDENTITY_USERS_PROVIDER, IDENTITY_ROLES_PROVIDER],
})
export class IdentityModule {}
