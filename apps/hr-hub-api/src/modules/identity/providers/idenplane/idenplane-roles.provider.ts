import { Injectable } from '@nestjs/common';
import { IdenplaneClient } from '../../../integrations/idenplane/idenplane.client';
import { IdentityRolesProvider } from '../../identity-roles.provider';
import { CreateIdentityRoleInput, IdentityRole, UpdateIdentityRoleInput } from '../../identity-roles.types';

@Injectable()
export class IdenplaneRolesProvider implements IdentityRolesProvider {
  constructor(private readonly idenplane: IdenplaneClient) {}

  listRoles(): Promise<IdentityRole[]> {
    return this.idenplane.adminRequest<IdentityRole[]>('GET', this.rolesPath());
  }

  createRole(input: CreateIdentityRoleInput): Promise<IdentityRole> {
    return this.idenplane.adminRequest<IdentityRole>('POST', this.rolesPath(), input);
  }

  updateRole(name: string, input: UpdateIdentityRoleInput): Promise<IdentityRole> {
    return this.idenplane.adminRequest<IdentityRole>('PATCH', `${this.rolesPath()}/${encodeURIComponent(name)}`, input);
  }

  async deleteRole(name: string): Promise<void> {
    await this.idenplane.adminRequest<void>('DELETE', `${this.rolesPath()}/${encodeURIComponent(name)}`);
  }

  private rolesPath(): string {
    return `/admin/realms/${encodeURIComponent(this.idenplane.getRealm())}/roles`;
  }
}
