import apiClient from './client';
import type { IdentityProvider } from '../types';
import { parseJsonObject } from '../utils/jsonFields';

// SQLite has no native Json column type, so IdentityProvider.samlConfig is
// stored as JSON-serialised TEXT and may come back from the API as a raw
// string rather than a real object. Parse it here so callers always see the
// clean shape declared by the `IdentityProvider` type.
function mapIdentityProvider(raw: IdentityProvider): IdentityProvider {
  return {
    ...raw,
    samlConfig: raw.samlConfig ? parseJsonObject(raw.samlConfig, {}) : raw.samlConfig,
  };
}

export async function getIdentityProviders(
  realmName: string,
): Promise<IdentityProvider[]> {
  const { data } = await apiClient.get<IdentityProvider[]>(
    `/realms/${realmName}/identity-providers`,
  );
  return data.map(mapIdentityProvider);
}

export async function getIdentityProvider(
  realmName: string,
  alias: string,
): Promise<IdentityProvider> {
  const { data } = await apiClient.get<IdentityProvider>(
    `/realms/${realmName}/identity-providers/${alias}`,
  );
  return mapIdentityProvider(data);
}

export interface CreateIdpPayload {
  alias: string;
  displayName?: string;
  enabled?: boolean;
  providerType?: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl?: string;
  jwksUrl?: string;
  issuer?: string;
  defaultScopes?: string;
  trustEmail?: boolean;
  linkOnly?: boolean;
  syncUserProfile?: boolean;
}

export async function createIdentityProvider(
  realmName: string,
  payload: CreateIdpPayload,
): Promise<IdentityProvider> {
  const { data } = await apiClient.post<IdentityProvider>(
    `/realms/${realmName}/identity-providers`,
    payload,
  );
  return mapIdentityProvider(data);
}

export async function updateIdentityProvider(
  realmName: string,
  alias: string,
  payload: Partial<CreateIdpPayload>,
): Promise<IdentityProvider> {
  const { data } = await apiClient.put<IdentityProvider>(
    `/realms/${realmName}/identity-providers/${alias}`,
    payload,
  );
  return mapIdentityProvider(data);
}

export async function deleteIdentityProvider(
  realmName: string,
  alias: string,
): Promise<void> {
  await apiClient.delete(
    `/realms/${realmName}/identity-providers/${alias}`,
  );
}
