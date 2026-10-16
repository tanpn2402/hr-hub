import { FileArchive, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  formatBytes,
  getErrorMessage,
  inspectWebAppPackage,
  type InspectedPackage,
} from '../api/web-apps';
import { isSupportedArchive, WebAppUploadField } from './WebAppUploadField';

type Props = {
  value: InspectedPackage | null;
  onChange: (pkg: InspectedPackage | null) => void;
  disabled?: boolean;
};

/**
 * Picks an archive and uploads it right away to POST /web-apps/inspect: the API extracts and validates it and
 * answers with what the package declares (hrhub.json) so the form can fill itself in. The form then submits the
 * returned token instead of uploading the file again.
 */
export function WebAppPackageField({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (next: File | null) => {
    setFile(next);
    setError(null);
    onChange(null);
    if (!next) return;
    if (!isSupportedArchive(next)) {
      setError(t('web_app_archive_unsupported'));
      return;
    }
    setProgress(0);
    try {
      onChange(await inspectWebAppPackage(next, setProgress));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProgress(null);
    }
  };

  const reading = progress !== null;

  return (
    <div className="space-y-2">
      <WebAppUploadField
        file={file}
        onChange={(next) => void pick(next)}
        disabled={disabled || reading}
      />

      {reading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {progress! < 100 ? `${t('uploading')} ${progress}%` : t('web_app_reading_package')}
        </div>
      )}

      {value && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
          {value.iconPreview ? (
            <img src={value.iconPreview} alt="" className="size-10 rounded-md object-contain" />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
              <FileArchive className="size-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 text-sm">
            <div className="truncate font-medium">{value.manifest?.name ?? value.archive.name}</div>
            <div className="text-xs text-muted-foreground">
              {value.archive.fileCount} {t('files')} · {formatBytes(value.archive.totalBytes)}
              {value.manifest ? ` · ${t('web_app_from_manifest')}` : ''}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
