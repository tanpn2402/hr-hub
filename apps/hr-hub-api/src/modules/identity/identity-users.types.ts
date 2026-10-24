export interface CreateIdentityUserInput {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  password?: string;
}

export interface UpdateIdentityUserInput {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
}

export interface AssignIdentityUserRolesInput {
  roleNames: string[];
}

export interface IdentityUserQuery {
  search?: string;
  username?: string;
  email?: string;
  page?: number;
  limit?: number;
}

export interface IdentityUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
  roles?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface IdentityUsersPage {
  users: IdentityUser[];
  total: number;
}
