import { Loader2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { getErrorMessage } from '../api/web-apps';
import { useUploadWebAppVersion } from '../hooks/useWebApps';
import { isSupportedArchive, WebAppUploadField } from './WebAppUploadField';

type Props = {
  webAppId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UploadWebAppVersionDialog({ webAppId, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const upload = useUploadWebAppVersion();

  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setNote('');
    setProgress(0);
    setError(null);
  };

  const handleOpenChange = (value: boolean) => {
    if (upload.isPending) return;
    if (!value) reset();
    onOpenChange(value);
  };

  const submit = (publish: boolean) => {
    if (!file) return setError(t('web_app_choose_archive'));
    if (!isSupportedArchive(file)) return setError(t('web_app_archive_unsupported'));
    setError(null);

    upload.mutate(
      { id: webAppId, file, note, publish, onProgress: setProgress },
      {
        onSuccess: () => {
          toast.success(t('web_app_version_uploaded'));
          reset();
          onOpenChange(false);
        },
        onError: (err) => setError(getErrorMessage(err)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('upload_new_version')}</DialogTitle>
          <DialogDescription>{t('upload_new_version_description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <WebAppUploadField file={file} onChange={setFile} disabled={upload.isPending} />

          <div className="space-y-1.5">
            <Label>{t('note')}</Label>
            <Input value={note} disabled={upload.isPending} onChange={(event) => setNote(event.target.value)} />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={upload.isPending}>
            {t('cancel')}
          </Button>
          <Button variant="outline" onClick={() => submit(false)} disabled={upload.isPending || !file}>
            {t('upload_only')}
          </Button>
          <Button onClick={() => submit(true)} disabled={upload.isPending || !file}>
            {upload.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {upload.isPending ? `${progress}%` : t('upload_and_publish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
