import apiClient from './client';
import { parseJsonArray } from '../utils/jsonFields';

// ─── Types ──────────────────────────────────────────────────

export type StepType =
  | 'password'
  | 'totp'
  | 'webauthn'
  | 'social'
  | 'ldap'
  | 'email_otp'
  | 'consent';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'not_in'
  | 'exists'
  | 'not_exists';

export interface FlowStepCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface FlowStep {
  id: string;
  type: StepType;
  required: boolean;
  order: number;
  condition?: FlowStepCondition | null;
  fallbackStepId?: string | null;
  config?: Record<string, unknown>;
}

export interface AuthFlow {
  id: string;
  realmId: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  steps: FlowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateAuthFlowPayload {
  name: string;
  description?: string;
  isDefault?: boolean;
  steps: FlowStep[];
}

export interface UpdateAuthFlowPayload {
  name?: string;
  description?: string;
  isDefault?: boolean;
  steps?: FlowStep[];
}

// ─── API Functions ───────────────────────────────────────────

// SQLite has no native Json column type, so AuthenticationFlow.steps is
// stored as JSON-serialised TEXT and may come back from the API as a raw
// string rather than a real array. Parse it here so callers always see the
// clean shape declared by the `AuthFlow` type.
function mapAuthFlow(raw: AuthFlow): AuthFlow {
  return { ...raw, steps: parseJsonArray(raw.steps) };
}

export async function getAuthFlows(realmName: string): Promise<AuthFlow[]> {
  const { data } = await apiClient.get<AuthFlow[]>(
    `/realms/${realmName}/auth-flows`,
  );
  return data.map(mapAuthFlow);
}

export async function getAuthFlowById(
  realmName: string,
  id: string,
): Promise<AuthFlow> {
  const { data } = await apiClient.get<AuthFlow>(
    `/realms/${realmName}/auth-flows/${id}`,
  );
  return mapAuthFlow(data);
}

export async function createAuthFlow(
  realmName: string,
  payload: CreateAuthFlowPayload,
): Promise<AuthFlow> {
  const { data } = await apiClient.post<AuthFlow>(
    `/realms/${realmName}/auth-flows`,
    payload,
  );
  return mapAuthFlow(data);
}

export async function updateAuthFlow(
  realmName: string,
  id: string,
  payload: UpdateAuthFlowPayload,
): Promise<AuthFlow> {
  const { data } = await apiClient.put<AuthFlow>(
    `/realms/${realmName}/auth-flows/${id}`,
    payload,
  );
  return mapAuthFlow(data);
}

export async function deleteAuthFlow(
  realmName: string,
  id: string,
): Promise<void> {
  await apiClient.delete(`/realms/${realmName}/auth-flows/${id}`);
}
