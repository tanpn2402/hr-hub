export type WebAppStatus = 'draft' | 'published' | 'disabled' | 'deleted';
export type ArchiveType = 'zip' | 'tar.gz';

/** Subset of the multer file used when `storage` is diskStorage. */
export interface UploadedArchive {
  path: string;
  originalname: string;
  size: number;
}

export interface CreateWebAppInput {
  slug?: string;
  name?: string;
  description?: string;
  requiredRoles?: unknown;
  isPrivate?: unknown;
  publish?: unknown;
  /** Token returned by POST /web-apps/inspect (the archive is already uploaded and extracted). */
  stagingToken?: unknown;
  /** JSON object (or its text in a multipart form): values for the settings the package declares. */
  settings?: unknown;
}

export interface UpdateWebAppInput {
  name?: string;
  description?: string | null;
  requiredRoles?: unknown;
  isPrivate?: unknown;
  settings?: unknown;
}

export interface UploadVersionInput {
  note?: string;
  publish?: unknown;
  stagingToken?: unknown;
  settings?: unknown;
}
