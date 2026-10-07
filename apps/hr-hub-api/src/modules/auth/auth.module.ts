import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AUTH_PROVIDER } from './auth-provider';
import { AuthGuard } from './auth.guard';
import { HrRolesGuard } from './hr-roles.guard';
import { AuthService } from './auth.service';
import { IdenplaneAuthProvider } from './providers/idenplane/idenplane-auth.provider';
import { IdenplaneClient } from './providers/idenplane/idenplane.client';

@Module({
  imports: [ConfigModule],
  providers: [
    AuthService,
    AuthGuard,
    HrRolesGuard,
    IdenplaneClient,
    IdenplaneAuthProvider,
    {
      provide: AUTH_PROVIDER,
      useExisting: IdenplaneAuthProvider,
    },
  ],
  exports: [AuthService, AuthGuard, HrRolesGuard],
})
export class AuthModule {}
