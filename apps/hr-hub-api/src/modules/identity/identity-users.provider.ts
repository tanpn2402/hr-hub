import {
  CreateIdentityUserInput,
  IdentityUser,
  IdentityUserQuery,
  IdentityUsersPage,
  UpdateIdentityUserInput,
} from './identity-users.types';

export interface IdentityUsersProvider {
  createUser(input: CreateIdentityUserInput): Promise<IdentityUser>;
  listUsers(query?: IdentityUserQuery): Promise<IdentityUsersPage>;
  getRealmRoles(userId: string): Promise<string[]>;
  replaceRealmRoles(userId: string, roleNames: string[]): Promise<void>;
  findUserByUsername(username: string): Promise<IdentityUser | null>;
  updateUser(userId: string, input: UpdateIdentityUserInput): Promise<IdentityUser>;
  deleteUser(userId: string): Promise<void>;
  assignRealmRoles(userId: string, roleNames: string[]): Promise<void>;
  assignClientRoles(userId: string, clientId: string, roleNames: string[]): Promise<void>;
  addUserToGroups(userId: string, groupIds: string[]): Promise<void>;
}

export const IDENTITY_USERS_PROVIDER = Symbol('IDENTITY_USERS_PROVIDER');
