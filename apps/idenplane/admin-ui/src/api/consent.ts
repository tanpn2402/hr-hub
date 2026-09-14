import apiClient from './client';
import type { ConsentCategory } from '../types';
import { parseJsonArray, parseJsonObject } from '../utils/jsonFields';

// ---------------------------------------------------------------------------
// Consent Categories
// ---------------------------------------------------------------------------

// SQLite has no native String[] column type, so ConsentCategory.scopes is
// stored as JSON-serialised TEXT and may come back from the API as a raw
// string rather than a real array. Parse it here so callers always see the
// clean shape declared by the `ConsentCategory` type.
function mapConsentCategory(raw: ConsentCategory): ConsentCategory {
  return { ...raw, scopes: parseJsonArray(raw.scopes) };
}

export async function getConsentCategories(
  realmName: string,
  includeDisabled = false,
): Promise<ConsentCategory[]> {
  const { data } = await apiClient.get<ConsentCategory[]>(
    `/realms/${realmName}/consent-categories`,
    { params: { includeDisabled } },
  );
  return data.map(mapConsentCategory);
}

export async function getConsentCategoryById(
  realmName: string,
  categoryId: string,
): Promise<ConsentCategory> {
  const { data } = await apiClient.get<ConsentCategory>(
    `/realms/${realmName}/consent-categories/${categoryId}`,
  );
  return mapConsentCategory(data);
}

export async function createConsentCategory(
  realmName: string,
  category: Partial<ConsentCategory>,
): Promise<ConsentCategory> {
  const { data } = await apiClient.post<ConsentCategory>(
    `/realms/${realmName}/consent-categories`,
    category,
  );
  return mapConsentCategory(data);
}

export async function updateConsentCategory(
  realmName: string,
  categoryId: string,
  category: Partial<ConsentCategory>,
): Promise<ConsentCategory> {
  const { data } = await apiClient.put<ConsentCategory>(
    `/realms/${realmName}/consent-categories/${categoryId}`,
    category,
  );
  return mapConsentCategory(data);
}

export async function deleteConsentCategory(
  realmName: string,
  categoryId: string,
): Promise<void> {
  await apiClient.delete(`/realms/${realmName}/consent-categories/${categoryId}`);
}

// ---------------------------------------------------------------------------
// User Consents
// ---------------------------------------------------------------------------

// A consent is an OAuth scope grant per client (no GDPR-category link); the
// shape mirrors users.service.getUserConsents exactly.
export interface UserConsent {
  id: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserConsentHistoryEntry {
  id: string;
  clientId: string;
  clientName: string;
  action: string;
  scopes: string[];
  policyVersion: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// SQLite has no native String[]/Json column type, so UserConsent.scopes and
// UserConsentHistory.scopes/.metadata are stored as JSON-serialised TEXT and
// may come back from the API as raw strings rather than real arrays/objects.
// Parse them here so callers always see the clean shapes declared above.
function mapUserConsent(raw: UserConsent): UserConsent {
  return { ...raw, scopes: parseJsonArray(raw.scopes) };
}

function mapUserConsentHistoryEntry(
  raw: UserConsentHistoryEntry,
): UserConsentHistoryEntry {
  return {
    ...raw,
    scopes: parseJsonArray(raw.scopes),
    metadata: raw.metadata ? parseJsonObject(raw.metadata, {}) : raw.metadata,
  };
}

export async function getUserConsents(
  realmName: string,
  userId: string,
): Promise<UserConsent[]> {
  const { data } = await apiClient.get<UserConsent[]>(
    `/realms/${realmName}/users/${userId}/consents`,
  );
  return data.map(mapUserConsent);
}

export interface UserConsentHistoryResponse {
  history: UserConsentHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getUserConsentHistory(
  realmName: string,
  userId: string,
  page = 1,
  limit = 20,
): Promise<UserConsentHistoryResponse> {
  const { data } = await apiClient.get<UserConsentHistoryResponse>(
    `/realms/${realmName}/users/${userId}/consents/history`,
    { params: { page, limit } },
  );
  return { ...data, history: data.history.map(mapUserConsentHistoryEntry) };
}

// ---------------------------------------------------------------------------
// Consent Statistics
// ---------------------------------------------------------------------------

export interface ConsentCategoryCount {
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  required: boolean;
  totalGrants: number;
  distinctUsers: number;
}

export interface ConsentStatistics {
  totalConsents: number;
  activeUsersWithConsents24h: number;
  activeUsersWithConsents7d: number;
  activeUsersWithConsents30d: number;
  consentActionsLast24h: number;
  consentActionsLast7d: number;
  consentActionsLast30d: number;
  consentsGranted24h: number;
  consentsRevoked24h: number;
  consentsUpdated24h: number;
  consentsByCategory: ConsentCategoryCount[];
  pendingDeletions: number;
  pendingDeletionsGracePeriod: number;
}

export async function getConsentStatistics(
  realmName: string,
): Promise<ConsentStatistics> {
  const { data } = await apiClient.get<ConsentStatistics>(
    `/realms/${realmName}/stats/consents`,
  );
  return data;
}

// ---------------------------------------------------------------------------
// Per-category statistics
// ---------------------------------------------------------------------------

export interface CategoryStatistics {
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  totalGrants: number;
  totalRevokes: number;
  grants24h: number;
  grants7d: number;
  grants30d: number;
  activeUsers24h: number;
  activeUsers7d: number;
  activeUsers30d: number;
}

export async function getCategoryStatistics(
  realmName: string,
  categoryId: string,
): Promise<CategoryStatistics> {
  const { data } = await apiClient.get<CategoryStatistics>(
    `/realms/${realmName}/consent-categories/${categoryId}/stats`,
  );
  return data;
}
