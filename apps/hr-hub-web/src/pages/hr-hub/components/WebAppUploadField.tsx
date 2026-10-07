import { Upload } from 'lucide-react';
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { formatBytes } from '../api/web-apps';

type Props = {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
};

export function isSupportedArchive(file: File) {
  return /\.(zip|tar\.gz|tgz)$/i.test(file.name);
}

export function WebAppUploadField({ file, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-lg border border-dashed p-5 text-center transition-colors hover:bg-muted/50">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept=".zip,.tar.gz,.tgz"
        className="hidden"
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />

      <label htmlFor={id} className="flex cursor-pointer flex-col items-center">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <Upload className="size-5 text-muted-foreground" />
        </div>
        <div className="mt-3 text-sm font-medium">{file ? file.name : t('web_app_choose_archive')}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {file ? formatBytes(file.size) : t('web_app_archive_hint')}
        </div>
      </label>
    </div>
  );
}
