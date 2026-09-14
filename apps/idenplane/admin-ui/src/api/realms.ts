import apiClient from './client';
import type { Realm, EmailProviderConfig, SmsProviderConfig, RealmTheme } from '../types';
import { parseJsonArray, parseJsonObject } from '../utils/jsonFields';

// parseJsonObject is constrained to `T extends Record<string, unknown>`, but
// the realm's config types are plain interfaces without an index signature,
// so TS won't infer them directly as T. Route through Record<string, unknown>
// and cast back to the declared shape.
function parseJsonConfig<T>(value: T | string | null | undefined): T | undefined {
  if (value == null) return value ?? undefined;
  return parseJsonObject(value as unknown as Record<string, unknown>, {}) as unknown as T;
}

// SQLite has no native String[]/Json column type, so allowedEmailDomains,
// supportedLocales, emailProviderConfig, smsProviderConfig and theme are
// stored as JSON-serialised TEXT and may come back from the API as raw
// strings rather than real arrays/objects (not every realm endpoint has been
// audited on the backend). Parse them here so callers always see the clean
// shape declared by the `Realm` type.
function mapRealm(raw: Realm): Realm {
  return {
    ...raw,
    allowedEmailDomains: parseJsonArray(raw.allowedEmailDomains),
    supportedLocales: parseJsonArray(raw.supportedLocales),
    emailProviderConfig: parseJsonConfig<EmailProviderConfig>(raw.emailProviderConfig) ?? null,
    smsProviderConfig: parseJsonConfig<SmsProviderConfig>(raw.smsProviderConfig),
    theme: parseJsonConfig<RealmTheme>(raw.theme) ?? null,
  };
}

export async function getAllRealms(): Promise<Realm[]> {
  const { data } = await apiClient.get<Realm[]>('/realms');
  return data.map(mapRealm);
}

export async function getRealmByName(name: string): Promise<Realm> {
  const { data } = await apiClient.get<Realm>(`/realms/${name}`);
  return mapRealm(data);
}

export async function createRealm(
  realm: Partial<Realm>,
): Promise<Realm> {
  const { data } = await apiClient.post<Realm>('/realms', realm);
  return mapRealm(data);
}

export async function updateRealm(
  name: string,
  realm: Partial<Realm>,
): Promise<Realm> {
  const { data } = await apiClient.put<Realm>(`/realms/${name}`, realm);
  return mapRealm(data);
}

export async function deleteRealm(name: string): Promise<void> {
  await apiClient.delete(`/realms/${name}`);
}

export async function exportRealm(
  name: string,
  options?: { includeUsers?: boolean; includeSecrets?: boolean },
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  if (options?.includeUsers) params.set('includeUsers', 'true');
  if (options?.includeSecrets) params.set('includeSecrets', 'true');
  const { data } = await apiClient.get(`/realms/${name}/export?${params.toString()}`);
  return data;
}

export async function importRealm(
  payload: Record<string, unknown>,
  options?: { overwrite?: boolean },
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams();
  if (options?.overwrite) params.set('overwrite', 'true');
  const { data } = await apiClient.post(`/realms/import?${params.toString()}`, payload);
  return data;
}

export interface ThemeInfo {
  name: string;
  displayName: string;
  description: string;
  colors: {
    primaryColor: string;
    backgroundColor: string;
    cardColor: string;
    textColor: string;
    labelColor: string;
    inputBorderColor: string;
    inputBgColor: string;
    mutedColor: string;
  };
}

export async function getThemes(): Promise<ThemeInfo[]> {
  const { data } = await apiClient.get<ThemeInfo[]>('/realms/themes');
  return data;
}

export async function sendTestEmail(
  name: string,
  to: string,
): Promise<{ message: string }> {
  const { data } = await apiClient.post(`/realms/${name}/email/test`, { to });
  return data;
}

export async function testRealmSmtp(
  name: string,
): Promise<{ success: boolean; error?: string }> {
  const { data } = await apiClient.post<{ success: boolean; error?: string }>(
    `/realms/${name}/smtp/test`,
  );
  return data;
}
