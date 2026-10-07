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
import { Textarea } from '@/components/ui/textarea';

import { getErrorMessage, type WebApp } from '../api/web-apps';
import { useCreateWebApp } from '../hooks/useWebApps';
import { RolesInput } from './RolesInput';
import { isSupportedArchive, WebAppUploadField } from './WebAppUploadField';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (app: WebApp) => void;
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);

export function CreateWebAppDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation();
  const createMutation = useCreateWebApp();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setSlug('');
    setSlugTouched(false);
    setDescription('');
    setRoles([]);
    setFile(null);
    setProgress(0);
    setError(null);
  };

  const handleOpenChange = (value: boolean) => {
    if (createMutation.isPending) return;
    if (!value) reset();
    onOpenChange(value);
  };

  const submit = () => {
    setError(null);

    if (!name.trim()) return setError(t('web_app_name_required'));
    if (!SLUG_PATTERN.test(slug)) return setError(t('web_app_slug_invalid'));
    if (file && !isSupportedArchive(file)) return setError(t('web_app_archive_unsupported'));

    createMutation.mutate(
      { name, slug, description, requiredRoles: roles, file, publish: Boolean(file), onProgress: setProgress },
      {
        onSuccess: (app) => {
          toast.success(t('web_app_created'));
          reset();
          onOpenChange(false);
          onCreated?.(app);
        },
        onError: (err) => setError(getErrorMessage(err)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('create_web_app')}</DialogTitle>
          <DialogDescription>{t('create_web_app_description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('name')}</Label>
            <Input
              value={name}
              disabled={createMutation.isPending}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('web_app_slug')}</Label>
            <Input
              value={slug}
              disabled={createMutation.isPending}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value.toLowerCase());
              }}
            />
            <p className="text-xs text-muted-foreground">
              /hr-hub/apps/{slug || '…'}/ — {t('web_app_slug_hint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('description')}</Label>
            <Textarea
              rows={2}
              value={description}
              disabled={createMutation.isPending}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('web_app_required_roles')}</Label>
            <RolesInput value={roles} onChange={setRoles} disabled={createMutation.isPending} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('web_app_archive_optional')}</Label>
            <WebAppUploadField file={file} onChange={setFile} disabled={createMutation.isPending} />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={createMutation.isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {createMutation.isPending && file ? `${progress}%` : t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
