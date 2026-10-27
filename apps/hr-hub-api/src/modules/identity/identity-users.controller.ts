import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { HrRolesGuard } from '../auth/hr-roles.guard';
import { IDENTITY_USERS_PROVIDER, IdentityUsersProvider } from './identity-users.provider';
import { AssignIdentityUserRolesInput, CreateIdentityUserInput, IdentityUserQuery, UpdateIdentityUserInput } from './identity-users.types';

@Controller('identity/users')
@UseGuards(AuthGuard, HrRolesGuard)
export class IdentityUsersController {
  constructor(@Inject(IDENTITY_USERS_PROVIDER) private readonly users: IdentityUsersProvider) {}

  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    const numeric = (value: string | undefined) => (value && /^\d+$/.test(value) ? Number(value) : undefined);
    const filters: IdentityUserQuery = {
      search: query.search,
      username: query.username,
      email: query.email,
      page: numeric(query.page),
      limit: numeric(query.limit),
    };
    return this.users.listUsers(filters);
  }

  @Post()
  create(@Body() input: CreateIdentityUserInput) {
    return this.users.createUser(input);
  }

  @Patch(':userId')
  update(@Param('userId') userId: string, @Body() input: UpdateIdentityUserInput) {
    return this.users.updateUser(userId, input);
  }

  @Get(':userId')
  getUser(@Param('userId') userId: string) {
    return this.users.getUserById(userId);
  }

  @Post(':userId/roles')
  replaceRoles(@Param('userId') userId: string, @Body() input: AssignIdentityUserRolesInput) {
    return this.users.replaceRealmRoles(userId, input.roleNames);
  }

  @Delete(':userId')
  remove(@Param('userId') userId: string) {
    return this.users.deleteUser(userId);
  }
}
