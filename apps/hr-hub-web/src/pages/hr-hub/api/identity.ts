import { apiClient } from '@/api/client';

export interface IdentityUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
  roles?: string[];
}

export interface IdentityUsersPage {
  users: IdentityUser[];
  total: number;
}

export interface IdentityRole {
  id: string;
  name: string;
  description?: string | null;
}

export type IdentityUserInput = Omit<IdentityUser, 'id' | 'emailVerified'> & { password?: string };

export async function getIdentityUsers(params: Record<string, string | number | undefined> = {}) {
  const { data } = await apiClient.get<IdentityUsersPage>('/identity/users', { params });
  return data;
}

export async function createIdentityUser(input: Partial<IdentityUserInput>) {
  const { data } = await apiClient.post<IdentityUser>('/identity/users', input);
  return data;
}

export async function updateIdentityUser(id: string, input: Partial<IdentityUserInput>) {
  const { data } = await apiClient.patch<IdentityUser>(`/identity/users/${id}`, input);
  return data;
}

export async function assignIdentityUserRoles(id: string, roleNames: string[]) {
  await apiClient.post(`/identity/users/${encodeURIComponent(id)}/roles`, { roleNames });
}

export async function deleteIdentityUser(id: string) {
  await apiClient.delete(`/identity/users/${id}`);
}

export async function getIdentityRoles() {
  const { data } = await apiClient.get<IdentityRole[]>('/identity/roles');
  return data;
}

export async function createIdentityRole(input: Pick<IdentityRole, 'name' | 'description'>) {
  const { data } = await apiClient.post<IdentityRole>('/identity/roles', input);
  return data;
}

export async function updateIdentityRole(
  name: string,
  input: Partial<Pick<IdentityRole, 'name' | 'description'>>,
) {
  const { data } = await apiClient.patch<IdentityRole>(
    `/identity/roles/${encodeURIComponent(name)}`,
    input,
  );
  return data;
}

export async function deleteIdentityRole(name: string) {
  await apiClient.delete(`/identity/roles/${encodeURIComponent(name)}`);
}
