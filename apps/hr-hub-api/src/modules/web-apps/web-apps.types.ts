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
  publish?: unknown;
}

export interface UpdateWebAppInput {
  name?: string;
  description?: string | null;
  requiredRoles?: unknown;
}

export interface UploadVersionInput {
  note?: string;
  publish?: unknown;
}
