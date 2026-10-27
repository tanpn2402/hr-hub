import axios from 'axios';
import { apiClient } from '@/api/client';
import { idenplane } from '@/lib/idenplane';

export type WebAppStatus = 'draft' | 'published' | 'disabled' | 'deleted';

/** A setting an app declares in its hrhub.json; the administrator enters the value per app. */
export type SettingType = 'app' | 'string' | 'text' | 'number' | 'boolean' | 'select';
export type SettingDefinition = {
  type: SettingType;
  label: string;
  description: string | null;
  required: boolean;
  default: string | number | boolean | null;
  options: Array<{ value: string; label: string }>;
  min: number | null;
  max: number | null;
};
export type SettingsSchema = Record<string, SettingDefinition>;
export type SettingValues = Record<string, string | number | boolean | null>;

/** What hrhub.json says about a package (validated by the API). */
export type WebAppManifest = {
  name: string | null;
  description: string | null;
  slug: string | null;
  icon: string | null;
  settings: SettingsSchema;
};

/** POST /web-apps/inspect: the archive is uploaded and extracted; submit the form with `token`. */
export type InspectedPackage = {
  token: string;
  expiresAt: string;
  archive: { name: string; size: number; fileCount: number; totalBytes: number };
  manifest: WebAppManifest | null;
  icon: string | null;
  iconPreview: string | null;
};

export type WebApp = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: WebAppStatus;
  requiredRoles: string[];
  /** "Only me": only the creator can see and open the app. */
  isPrivate: boolean;
  currentVersionId: string | null;
  currentVersion: number | null;
  /** Favicon file of the published version (favicon.svg/png/ico), null when the package has none. */
  icon: string | null;
  /** Settings the published version declares, their values (defaults filled in) and the required ones still empty. */
  settingsSchema: SettingsSchema;
  settings: SettingValues;
  missingSettings: string[];
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
  isPrivate?: boolean;
  file?: File | null;
  /** Instead of `file`: a package already uploaded through inspectWebAppPackage. */
  stagingToken?: string;
  settings?: SettingValues;
  publish?: boolean;
  onProgress?: (percent: number) => void;
};

export type UploadVersionParams = {
  id: string;
  file?: File | null;
  stagingToken?: string;
  settings?: SettingValues;
  note?: string;
  publish?: boolean;
  onProgress?: (percent: number) => void;
};

export type UpdateWebAppParams = {
  id: string;
  name?: string;
  description?: string | null;
  requiredRoles?: string[];
  isPrivate?: boolean;
  settings?: SettingValues;
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
  if (params.isPrivate) form.append('isPrivate', 'true');
  if (params.publish) form.append('publish', 'true');
  if (params.settings) form.append('settings', JSON.stringify(params.settings));
  if (params.stagingToken) form.append('stagingToken', params.stagingToken);
  else if (params.file) form.append('file', params.file);

  const { data } = await apiClient.post<WebApp>('/web-apps', form, {
    timeout: UPLOAD_TIMEOUT,
    onUploadProgress: (event) => {
      if (event.total) params.onProgress?.(Math.round((event.loaded / event.total) * 100));
    },
  });
  return data;
}

/** Uploads and validates a package without creating anything; returns what it declares and a token. */
export async function inspectWebAppPackage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<InspectedPackage> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<InspectedPackage>('/web-apps/inspect', form, {
    timeout: UPLOAD_TIMEOUT,
    onUploadProgress: (event) => {
      if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
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
  if (params.settings) form.append('settings', JSON.stringify(params.settings));
  if (params.stagingToken) form.append('stagingToken', params.stagingToken);
  else if (params.file) form.append('file', params.file);

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
  currentVersion: number | null;
  icon: string | null;
};

/** Public URL of a web app's favicon (served with the app's static files); `?v=` busts the cache per version. */
export function webAppIconUrl(app: {
  slug: string;
  icon: string | null;
  currentVersion: number | null;
}) {
  if (!app.icon) return null;
  return `${apiClient.defaults.baseURL}/apps/${encodeURIComponent(app.slug)}/${app.icon}?v=${app.currentVersion ?? 0}`;
}

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

export type WebAppAccessRequest = {
  id: string;
  webAppId: string;
  appSlug: string;
  appName: string;
  requesterId: string;
  requesterUsername: string | null;
  requesterEmail: string | null;
  message: string;
  requiredRoles: string[];
  status: Exclude<AccessRequestStatus, 'none'>;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decidedByName: string | null;
  note: string | null;
};

export type AccessRequestDecision = 'approved' | 'rejected';

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

export async function getWebAppAccessRequests(): Promise<WebAppAccessRequest[]> {
  const { data } = await apiClient.get<WebAppAccessRequest[]>('/web-apps/access-requests');
  return data;
}

export async function decideWebAppAccessRequest(
  id: string,
  decision: AccessRequestDecision,
  note: string,
): Promise<WebAppAccessRequest> {
  const { data } = await apiClient.patch<WebAppAccessRequest>(
    `/web-apps/access-requests/${encodeURIComponent(id)}`,
    { decision, note },
  );
  return data;
}

export type WebAppDataOp =
  'list' | 'get' | 'set' | 'remove' | 'employees' | 'readApp' | 'me' | 'all' | 'settings';

/** Settings of an app (hrhub.json "settings", as the administrator filled them in). */
async function readSettings(slug: string): Promise<SettingValues> {
  const { data } = await apiClient.get<SettingValues>(
    `/web-apps/${encodeURIComponent(slug)}/settings`,
  );
  return data;
}

/** Executes a data operation for the app identified by the route slug (never by the app itself). */
export async function runWebAppDataOp(
  slug: string,
  op: WebAppDataOp,
  args: Record<string, unknown>,
) {
  if (op === 'settings') return readSettings(slug);
  if (op === 'readApp') {
    // { setting: 'sourceApp' }: the target is whatever app the administrator chose in that "app" setting.
    if (typeof args.setting === 'string') {
      const target = (await readSettings(slug))[args.setting];
      if (typeof target !== 'string' || !target)
        throw new Error(`Setting "${args.setting}" is not set`);
      return readOtherAppData(target);
    }
    return readOtherAppData(String(args.app ?? ''));
  }
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
