import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { HrRolesGuard } from '../auth/hr-roles.guard';
import { IDENTITY_ROLES_PROVIDER, IdentityRolesProvider } from './identity-roles.provider';
import { CreateIdentityRoleInput, UpdateIdentityRoleInput } from './identity-roles.types';

@Controller('identity/roles')
@UseGuards(AuthGuard, HrRolesGuard)
export class IdentityRolesController {
  constructor(@Inject(IDENTITY_ROLES_PROVIDER) private readonly roles: IdentityRolesProvider) {}

  @Get()
  list() {
    return this.roles.listRoles();
  }

  @Post()
  create(@Body() input: CreateIdentityRoleInput) {
    return this.roles.createRole(input);
  }

  @Patch(':name')
  update(@Param('name') name: string, @Body() input: UpdateIdentityRoleInput) {
    return this.roles.updateRole(name, input);
  }

  @Delete(':name')
  remove(@Param('name') name: string) {
    return this.roles.deleteRole(name);
  }
}
