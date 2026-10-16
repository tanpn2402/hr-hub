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

import {
  getErrorMessage,
  type InspectedPackage,
  type SettingValues,
  type WebApp,
} from '../api/web-apps';
import { useUploadWebAppVersion } from '../hooks/useWebApps';
import { WebAppPackageField } from './WebAppPackageField';
import { initialSettings, missingSettings, WebAppSettingsFields } from './WebAppSettingsFields';

type Props = {
  app: WebApp;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function UploadWebAppVersionDialog({ app, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const upload = useUploadWebAppVersion();

  // The package is uploaded and validated as soon as it is picked (inspect); the settings shown are the ones the
  // NEW version declares, pre-filled with what the app already has (only new keys need input).
  const [pkg, setPkg] = useState<InspectedPackage | null>(null);
  const [settings, setSettings] = useState<SettingValues>({});
  const [showSettingErrors, setShowSettingErrors] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const schema = pkg?.manifest?.settings ?? {};
  const newKeys = Object.keys(schema).filter((key) => !(key in app.settingsSchema));

  const reset = () => {
    setPkg(null);
    setSettings({});
    setShowSettingErrors(false);
    setNote('');
    setError(null);
  };

  const handleOpenChange = (value: boolean) => {
    if (upload.isPending) return;
    if (!value) reset();
    onOpenChange(value);
  };

  const onPackage = (next: InspectedPackage | null) => {
    setPkg(next);
    setSettings(initialSettings(next?.manifest?.settings ?? {}, app.settings));
    setShowSettingErrors(false);
  };

  const submit = (publish: boolean) => {
    if (!pkg) return setError(t('web_app_choose_archive'));
    if (publish && missingSettings(schema, settings).length) return setShowSettingErrors(true);
    setError(null);

    upload.mutate(
      { id: app.id, stagingToken: pkg.token, settings, note, publish },
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('upload_new_version')}</DialogTitle>
          <DialogDescription>{t('upload_new_version_description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <WebAppPackageField value={pkg} onChange={onPackage} disabled={upload.isPending} />

          {Object.keys(schema).length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">{t('web_app_settings')}</div>
                <p className="text-xs text-muted-foreground">
                  {newKeys.length
                    ? t('web_app_settings_new', { keys: newKeys.join(', ') })
                    : t('web_app_settings_hint')}
                </p>
              </div>
              <WebAppSettingsFields
                schema={schema}
                values={settings}
                onChange={setSettings}
                disabled={upload.isPending}
                selfSlug={app.slug}
                showErrors={showSettingErrors}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t('note')}</Label>
            <Input
              value={note}
              disabled={upload.isPending}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="min-w-32"
            onClick={() => handleOpenChange(false)}
            disabled={upload.isPending}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="outline"
            className="min-w-32"
            onClick={() => submit(false)}
            disabled={upload.isPending || !pkg}
          >
            {t('upload_only')}
          </Button>
          <Button
            className="min-w-32"
            onClick={() => submit(true)}
            disabled={upload.isPending || !pkg}
          >
            {upload.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {t('upload_and_publish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
