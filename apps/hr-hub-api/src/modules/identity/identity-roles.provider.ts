import { CreateIdentityRoleInput, IdentityRole, UpdateIdentityRoleInput } from './identity-roles.types';

export interface IdentityRolesProvider {
  listRoles(): Promise<IdentityRole[]>;
  createRole(input: CreateIdentityRoleInput): Promise<IdentityRole>;
  updateRole(name: string, input: UpdateIdentityRoleInput): Promise<IdentityRole>;
  deleteRole(name: string): Promise<void>;
}

export const IDENTITY_ROLES_PROVIDER = Symbol('IDENTITY_ROLES_PROVIDER');
