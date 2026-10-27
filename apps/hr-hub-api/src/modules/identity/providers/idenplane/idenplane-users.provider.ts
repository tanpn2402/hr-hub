import { Injectable, NotFoundException } from '@nestjs/common';
import { IdenplaneClient } from '../../../integrations/idenplane/idenplane.client';
import { IdenplaneRoleAssignmentResult, IdenplaneUser, IdenplaneUsersPage } from '../../../integrations/idenplane/idenplane.types';
import { IdentityUsersProvider } from '../../identity-users.provider';
import {
  CreateIdentityUserInput,
  IdentityUser,
  IdentityUserQuery,
  IdentityUsersPage as IdentityUsersPageResult,
  UpdateIdentityUserInput,
} from '../../identity-users.types';

@Injectable()
export class IdenplaneUsersProvider implements IdentityUsersProvider {
  constructor(private readonly idenplane: IdenplaneClient) {}

  async createUser(input: CreateIdentityUserInput): Promise<IdentityUser> {
    const user = await this.idenplane.adminRequest<IdenplaneUser>('POST', `${this.adminBasePath()}/users`, input);
    return this.toIdentityUser(user);
  }

  async findUserByUsername(username: string): Promise<IdentityUser | null> {
    const page = await this.listUsers({ username, page: 1, limit: 100 });
    const user = page.users.find((candidate) => candidate.username === username);
    return user ?? null;
  }

  async listUsers(query: IdentityUserQuery = {}): Promise<IdentityUsersPageResult> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const page = await this.idenplane.adminRequest<IdenplaneUsersPage>(
      'GET',
      `${this.adminBasePath()}/users${params.size ? `?${params.toString()}` : ''}`,
    );
    const users = await Promise.all(
      page.users.map(async (user) => ({
        ...this.toIdentityUser(user),
        roles: await this.getRealmRoles(user.id),
      })),
    );
    return { users, total: page.total };
  }

  async getUserById(userId: string): Promise<IdentityUser> {
    const user = await this.idenplane.adminRequest<IdenplaneUser>('GET', this.userPath(userId));
    return {
      ...this.toIdentityUser(user),
      roles: await this.getRealmRoles(userId),
    };
  }

  async getRealmRoles(userId: string): Promise<string[]> {
    const roles = await this.idenplane.adminRequest<Array<{ name: string }>>('GET', `${this.userPath(userId)}/role-mappings/realm`);
    return roles.map((role) => role.name);
  }

  async updateUser(userId: string, input: UpdateIdentityUserInput): Promise<IdentityUser> {
    const user = await this.idenplane.adminRequest<IdenplaneUser>('PATCH', this.userPath(userId), input);
    return this.toIdentityUser(user);
  }

  async deleteUser(userId: string): Promise<void> {
    await this.idenplane.adminRequest<void>('DELETE', this.userPath(userId));
  }

  async assignRealmRoles(userId: string, roleNames: string[]): Promise<void> {
    const result = await this.idenplane.adminRequest<IdenplaneRoleAssignmentResult>(
      'POST',
      `${this.userPath(userId)}/role-mappings/realm`,
      { roleNames },
    );
    this.assertAllRolesAssigned(roleNames, result.assigned);
  }

  async replaceRealmRoles(userId: string, roleNames: string[]): Promise<void> {
    const currentRoles = await this.getRealmRoles(userId);
    const requestedRoles = [...new Set(roleNames)];

    if (requestedRoles.length > 0) {
      await this.assignRealmRoles(userId, requestedRoles);
    }

    const rolesToRemove = currentRoles.filter((roleName) => !requestedRoles.includes(roleName));
    if (rolesToRemove.length > 0) {
      await this.idenplane.adminRequest<void>('DELETE', `${this.userPath(userId)}/role-mappings/realm`, { roleNames: rolesToRemove });
    }
  }

  async assignClientRoles(userId: string, clientId: string, roleNames: string[]): Promise<void> {
    const result = await this.idenplane.adminRequest<IdenplaneRoleAssignmentResult>(
      'POST',
      `${this.userPath(userId)}/role-mappings/clients/${encodeURIComponent(clientId)}`,
      { roleNames },
    );
    this.assertAllRolesAssigned(roleNames, result.assigned);
  }

  async addUserToGroups(userId: string, groupIds: string[]): Promise<void> {
    for (const groupId of groupIds) {
      await this.idenplane.adminRequest<void>('PUT', `${this.userPath(userId)}/groups/${encodeURIComponent(groupId)}`);
    }
  }

  private adminBasePath(): string {
    return `/admin/realms/${encodeURIComponent(this.idenplane.getRealm())}`;
  }

  private userPath(userId: string): string {
    return `${this.adminBasePath()}/users/${encodeURIComponent(userId)}`;
  }

  private assertAllRolesAssigned(requested: string[], assigned: string[]): void {
    const assignedNames = new Set(assigned);
    const missing = requested.filter((role) => !assignedNames.has(role));
    if (missing.length > 0) {
      throw new NotFoundException(`Idenplane did not assign roles: ${missing.join(', ')}`);
    }
  }

  private toIdentityUser(user: IdenplaneUser): IdentityUser {
    return {
      id: user.id,
      username: user.username,
      ...(user.email ? { email: user.email } : {}),
      ...(user.firstName ? { firstName: user.firstName } : {}),
      ...(user.lastName ? { lastName: user.lastName } : {}),
      enabled: user.enabled,
      emailVerified: user.emailVerified ?? false,
    };
  }
}
