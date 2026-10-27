import { Module } from '@nestjs/common';
import { AUTH_PROVIDER } from './auth-provider';
import { AuthGuard } from './auth.guard';
import { HrRolesGuard } from './hr-roles.guard';
import { AuthService } from './auth.service';
import { IdenplaneAuthProvider } from './providers/idenplane/idenplane-auth.provider';
import { IdenplaneModule } from '../integrations/idenplane/idenplane.module';

@Module({
  imports: [IdenplaneModule],
  providers: [
    AuthService,
    AuthGuard,
    HrRolesGuard,
    IdenplaneAuthProvider,
    {
      provide: AUTH_PROVIDER,
      useExisting: IdenplaneAuthProvider,
    },
  ],
  exports: [AuthService, AuthGuard, HrRolesGuard],
})
export class AuthModule {}
