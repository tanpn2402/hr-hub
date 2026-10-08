import axios from 'axios';
import { apiClient } from '@/api/client';
import { idenplane } from '@/lib/idenplane';

export type WebAppStatus = 'draft' | 'published' | 'disabled' | 'deleted';

export type WebApp = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: WebAppStatus;
  requiredRoles: string[];
  currentVersionId: string | null;
  currentVersion: number | null;
  url: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WebAppVersion = {
  id: string;
  webAppId: string;
  version: number;
  archiveName: string;
  archiveType: string;
  archiveSize: number;
  size: number;
  fileCount: number;
  checksum: string;
  status: string;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
  isCurrent: boolean;
};

export type CreateWebAppParams = {
  name: string;
  slug: string;
  description?: string;
  requiredRoles: string[];
  file?: File | null;
  publish?: boolean;
  onProgress?: (percent: number) => void;
};

export type UploadVersionParams = {
  id: string;
  file: File;
  note?: string;
  publish?: boolean;
  onProgress?: (percent: number) => void;
};

export type UpdateWebAppParams = {
  id: string;
  name?: string;
  description?: string | null;
  requiredRoles?: string[];
};

/** Upload timeout is longer than the default 30s used for JSON calls. */
const UPLOAD_TIMEOUT = 5 * 60_000;

export async function getWebApps(): Promise<WebApp[]> {
  const { data } = await apiClient.get<WebApp[]>('/web-apps');
  return data;
}

export async function getWebApp(id: string): Promise<WebApp> {
  const { data } = await apiClient.get<WebApp>(`/web-apps/${id}`);
  return data;
}

export async function createWebApp(params: CreateWebAppParams): Promise<WebApp> {
  const form = new FormData();
  form.append('name', params.name);
  form.append('slug', params.slug);
  if (params.description) form.append('description', params.description);
  form.append('requiredRoles', JSON.stringify(params.requiredRoles));
  if (params.publish) form.append('publish', 'true');
  if (params.file) form.append('file', params.file);

  const { data } = await apiClient.post<WebApp>('/web-apps', form, {
    timeout: UPLOAD_TIMEOUT,
    onUploadProgress: (event) => {
      if (event.total) params.onProgress?.(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data;
}

export async function updateWebApp({ id, ...body }: UpdateWebAppParams): Promise<WebApp> {
  const { data } = await apiClient.patch<WebApp>(`/web-apps/${id}`, body);
  return data;
}

export async function deleteWebApp(id: string) {
  await apiClient.delete(`/web-apps/${id}`);
}

export async function getWebAppVersions(id: string): Promise<WebAppVersion[]> {
  const { data } = await apiClient.get<WebAppVersion[]>(`/web-apps/${id}/versions`);
  return data;
}

export async function uploadWebAppVersion(params: UploadVersionParams): Promise<WebAppVersion> {
  const form = new FormData();
  if (params.note) form.append('note', params.note);
  if (params.publish) form.append('publish', 'true');
  form.append('file', params.file);

  const { data } = await apiClient.post<WebAppVersion>(`/web-apps/${params.id}/versions`, form, {
    timeout: UPLOAD_TIMEOUT,
    onUploadProgress: (event) => {
      if (event.total) params.onProgress?.(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data;
}

export async function publishWebAppVersion(id: string, version: number): Promise<WebApp> {
  const { data } = await apiClient.post<WebApp>(`/web-apps/${id}/versions/${version}/publish`);
  return data;
}

export async function rollbackWebAppVersion(id: string, version: number): Promise<WebApp> {
  const { data } = await apiClient.post<WebApp>(`/web-apps/${id}/versions/${version}/rollback`);
  return data;
}

export async function setWebAppEnabled(id: string, enabled: boolean): Promise<WebApp> {
  const { data } = await apiClient.post<WebApp>(
    `/web-apps/${id}/${enabled ? 'enable' : 'disable'}`,
  );
  return data;
}

/* ------------------------------ runtime (viewer) ------------------------------ */

export type WebAppAccess = {
  slug: string;
  name: string;
  description: string | null;
  status: string;
};

export async function getWebAppAccess(slug: string): Promise<WebAppAccess> {
  const { data } = await apiClient.get<WebAppAccess>(
    `/web-apps/${encodeURIComponent(slug)}/access`,
  );
  return data;
}

/* --------------------------- access requests --------------------------- */

export type AccessRequestStatus = 'none' | 'pending' | 'approved' | 'rejected';

export type AccessRequestState = {
  status: AccessRequestStatus;
  requestedAt: string | null;
  decidedAt: string | null;
  note: string | null;
};

export async function getMyAccessRequest(slug: string): Promise<AccessRequestState> {
  const { data } = await apiClient.get<AccessRequestState>(
    `/web-apps/${encodeURIComponent(slug)}/access-request`,
  );
  return data;
}

export async function requestWebAppAccess(
  slug: string,
  message: string,
): Promise<AccessRequestState> {
  const { data } = await apiClient.post<AccessRequestState>(
    `/web-apps/${encodeURIComponent(slug)}/access-request`,
    { message },
  );
  return data;
}

export type WebAppDataOp =
  'list' | 'get' | 'set' | 'remove' | 'employees' | 'readApp' | 'me' | 'all';

/** Executes a data operation for the app identified by the route slug (never by the app itself). */
export async function runWebAppDataOp(
  slug: string,
  op: WebAppDataOp,
  args: Record<string, unknown>,
) {
  if (op === 'readApp') return readOtherAppData(String(args.app ?? ''));
  if (op === 'me') return readCurrentUser();
  // Every record of THIS app (slug comes from the route, never from the app).
  if (op === 'all') return readOtherAppData(slug);

  const base = `/web-apps/${encodeURIComponent(slug)}/data`;
  const key = encodeURIComponent(String(args.key ?? ''));

  switch (op) {
    case 'employees': {
      // Capability granted to web apps: a minimal employee directory. E-mail is included so an app can link the
      // signed-in user to their employee record; phone and other personal fields are not.
      const { data } = await apiClient.get<Array<Record<string, unknown>>>('/employees');
      return data
        .filter((employee) => employee.active !== false)
        .map(({ id, employeeCode, name, email, department, position }) => ({
          id,
          employeeCode,
          name,
          email,
          department,
          position,
        }));
    }
    case 'list':
      return (await apiClient.get(base)).data;
    case 'get':
      try {
        return (await apiClient.get(`${base}/${key}`)).data;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) return null;
        throw error;
      }
    case 'set':
      return (
        await apiClient.put(`${base}/${key}`, { value: args.value, ifUpdatedAt: args.ifUpdatedAt })
      ).data;
    case 'remove':
      return (await apiClient.delete(`${base}/${key}`)).data;
    default:
      throw new Error('Unsupported operation');
  }
}

/**
 * Read-only access to ANOTHER app's data (e.g. a results app reading a form app's submissions).
 * The API still enforces the target app's required roles for the signed-in user on every call.
 */
async function readOtherAppData(app: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(app)) throw new Error('Invalid app');
  const base = `/web-apps/${encodeURIComponent(app)}/data`;

  const { data: keys } = await apiClient.get<Array<{ key: string }>>(base);
  const entries: unknown[] = [];

  for (let i = 0; i < keys.length; i += 10) {
    const batch = await Promise.all(
      keys
        .slice(i, i + 10)
        .map(({ key }) => apiClient.get(`${base}/${encodeURIComponent(key)}`).then((r) => r.data)),
    );
    entries.push(...batch);
  }
  return entries;
}

export type WebAppUser = {
  authenticated: boolean;
  id: string | null;
  username: string | null;
  name: string | null;
  email: string | null;
  /** Realm roles + all client roles (the same set the API authorizes with). */
  roles: string[];
  /** Group names from the identity provider's `groups` claim; empty when the IdP doesn't release groups. */
  groups: string[];
};

const ANONYMOUS_USER: WebAppUser = {
  authenticated: false,
  id: null,
  username: null,
  name: null,
  email: null,
  roles: [],
  groups: [],
};

let userCache: { at: number; user: WebAppUser } | null = null;

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** The signed-in user as web apps may see them. Never includes tokens. Anonymous visitors get an empty user. */
async function readCurrentUser(): Promise<WebAppUser> {
  if (!idenplane.isAuthenticated()) return ANONYMOUS_USER;
  if (userCache && Date.now() - userCache.at < 60_000) return userCache.user;

  // Fresh userinfo can carry more claims (e.g. groups) than the tokens; fall back to the cached/ID-token data.
  const info = (await idenplane.fetchUserInfo().catch(() => null)) ?? idenplane.getUserInfo();
  const access = (idenplane.getTokenClaims() ?? {}) as Record<string, unknown>;
  const claims = { ...(idenplane.getIdTokenClaims() ?? {}), ...access, ...(info ?? {}) } as Record<
    string,
    unknown
  >;

  const realmAccess = (access.realm_access ?? claims.realm_access) as
    { roles?: unknown } | undefined;
  const resourceAccess = (access.resource_access ?? claims.resource_access ?? {}) as Record<
    string,
    { roles?: unknown }
  >;

  const user: WebAppUser = {
    authenticated: true,
    id: typeof claims.sub === 'string' ? claims.sub : null,
    username: typeof claims.preferred_username === 'string' ? claims.preferred_username : null,
    name: typeof claims.name === 'string' ? claims.name : null,
    email: typeof claims.email === 'string' ? claims.email : null,
    roles: [
      ...new Set([
        ...asStrings(realmAccess?.roles),
        ...Object.values(resourceAccess).flatMap((resource) => asStrings(resource?.roles)),
      ]),
    ],
    groups: [...new Set(asStrings(claims.groups))],
  };

  userCache = { at: Date.now(), user };
  return user;
}

export function getErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown; errors?: unknown } | undefined;
    const errors = Array.isArray(data?.errors) ? (data.errors as string[]).join('; ') : '';
    const message = Array.isArray(data?.message) ? data.message.join('; ') : data?.message;
    return (
      [typeof message === 'string' ? message : '', errors].filter(Boolean).join(' - ') ||
      error.message
    );
  }
  return error instanceof Error ? error.message : fallback;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
