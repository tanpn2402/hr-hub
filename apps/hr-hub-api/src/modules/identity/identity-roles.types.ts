export interface CreateIdentityRoleInput {
  name: string;
  description?: string;
}

export interface UpdateIdentityRoleInput {
  name?: string;
  description?: string;
}

export interface IdentityRole {
  id: string;
  name: string;
  description?: string | null;
}
