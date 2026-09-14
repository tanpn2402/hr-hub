import apiClient from './client';
import type { Client, User } from '../types';
import { parseJsonArray } from '../utils/jsonFields';

// SQLite has no native String[] column type, so redirectUris/webOrigins/
// grantTypes (and postLogoutRedirectUris, not currently part of the `Client`
// type below) are stored as JSON-serialised TEXT. Some backend endpoints
// already parse them back into real arrays before responding (see
// toClientResponse() in clients.service.ts), but this is a defensive
// normalisation for any that don't — mirroring the precedent bug where a raw
// JSON string reached `(client.redirectUris || []).join(...)`.
function mapClient(raw: Client): Client {
  return {
    ...raw,
    redirectUris: parseJsonArray(raw.redirectUris),
    webOrigins: parseJsonArray(raw.webOrigins),
    grantTypes: parseJsonArray(raw.grantTypes),
  };
}

export async function getClients(realmName: string): Promise<Client[]> {
  const { data } = await apiClient.get<Client[]>(
    `/realms/${realmName}/clients`,
  );
  return data.map(mapClient);
}

export async function getClientById(
  realmName: string,
  id: string,
): Promise<Client> {
  const { data } = await apiClient.get<Client>(
    `/realms/${realmName}/clients/${id}`,
  );
  return mapClient(data);
}

export async function createClient(
  realmName: string,
  client: Partial<Client>,
): Promise<Client> {
  const { data } = await apiClient.post<Client>(
    `/realms/${realmName}/clients`,
    client,
  );
  return mapClient(data);
}

export async function updateClient(
  realmName: string,
  id: string,
  client: Partial<Client>,
): Promise<Client> {
  const { data } = await apiClient.put<Client>(
    `/realms/${realmName}/clients/${id}`,
    client,
  );
  return mapClient(data);
}

export async function deleteClient(
  realmName: string,
  id: string,
): Promise<void> {
  await apiClient.delete(`/realms/${realmName}/clients/${id}`);
}

export async function regenerateSecret(
  realmName: string,
  id: string,
): Promise<{ clientSecret: string }> {
  const { data } = await apiClient.post<{ clientSecret: string }>(
    `/realms/${realmName}/clients/${id}/regenerate-secret`,
  );
  return data;
}

export async function getServiceAccountUser(
  realmName: string,
  clientId: string,
): Promise<User> {
  const { data } = await apiClient.get<User>(
    `/realms/${realmName}/clients/${clientId}/service-account-user`,
  );
  return data;
}
