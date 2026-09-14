import apiClient from './client';
import type { SamlServiceProvider } from '../types';
import { parseJsonArray, parseJsonObject } from '../utils/jsonFields';

// SQLite has no native String[]/Json column type, so attributeStatements and
// validRedirectUris are stored as JSON-serialised TEXT and may come back
// from the API as raw strings rather than a real object/array. Parse them
// here so callers always see the clean shape declared by the
// `SamlServiceProvider` type.
function mapSamlSp(raw: SamlServiceProvider): SamlServiceProvider {
  return {
    ...raw,
    attributeStatements: parseJsonObject(raw.attributeStatements, {}),
    validRedirectUris: parseJsonArray(raw.validRedirectUris),
  };
}

export async function getSamlSps(
  realmName: string,
): Promise<SamlServiceProvider[]> {
  const { data } = await apiClient.get<SamlServiceProvider[]>(
    `/realms/${realmName}/saml-service-providers`,
  );
  return data.map(mapSamlSp);
}

export async function getSamlSp(
  realmName: string,
  id: string,
): Promise<SamlServiceProvider> {
  const { data } = await apiClient.get<SamlServiceProvider>(
    `/realms/${realmName}/saml-service-providers/${id}`,
  );
  return mapSamlSp(data);
}

export interface CreateSamlSpPayload {
  entityId: string;
  name: string;
  acsUrl: string;
  enabled?: boolean;
  sloUrl?: string;
  certificate?: string;
  nameIdFormat?: string;
  signAssertions?: boolean;
  signResponses?: boolean;
  attributeStatements?: Record<string, unknown>;
  validRedirectUris?: string[];
}

export async function createSamlSp(
  realmName: string,
  payload: CreateSamlSpPayload,
): Promise<SamlServiceProvider> {
  const { data } = await apiClient.post<SamlServiceProvider>(
    `/realms/${realmName}/saml-service-providers`,
    payload,
  );
  return mapSamlSp(data);
}

export async function updateSamlSp(
  realmName: string,
  id: string,
  payload: Partial<CreateSamlSpPayload>,
): Promise<SamlServiceProvider> {
  const { data } = await apiClient.put<SamlServiceProvider>(
    `/realms/${realmName}/saml-service-providers/${id}`,
    payload,
  );
  return mapSamlSp(data);
}

export async function deleteSamlSp(
  realmName: string,
  id: string,
): Promise<void> {
  await apiClient.delete(
    `/realms/${realmName}/saml-service-providers/${id}`,
  );
}
