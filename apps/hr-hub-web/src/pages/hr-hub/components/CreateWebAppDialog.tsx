import { Loader2, Upload } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { getErrorMessage, type WebApp } from '../api/web-apps';
import { useCreateWebApp } from '../hooks/useWebApps';
import { PrivateWebAppCheckbox } from './PrivateWebAppCheckbox';
import { RolesInput } from './RolesInput';
import { isSupportedArchive, WebAppUploadField } from './WebAppUploadField';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (app: WebApp) => void;
};

type FormValues = {
  name: string;
  slug: string;
  description: string;
  roles: string[];
  isPrivate: boolean;
  file: File | null;
};

const DEFAULT_VALUES: FormValues = {
  name: '',
  slug: '',
  description: '',
  roles: [],
  isPrivate: false,
  file: null,
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
  const [progress, setProgress] = useState(0);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getFieldState,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULT_VALUES });

  const pending = createMutation.isPending;
  const slug = watch('slug');
  const isPrivate = watch('isPrivate');
  const file = watch('file');

  const resetForm = () => {
    reset(DEFAULT_VALUES);
    setProgress(0);
  };

  const handleOpenChange = (value: boolean) => {
    if (pending) return;
    if (!value) resetForm();
    onOpenChange(value);
  };

  const onSubmit = (values: FormValues) =>
    createMutation.mutate(
      {
        name: values.name,
        slug: values.slug,
        description: values.description,
        requiredRoles: values.isPrivate ? [] : values.roles,
        isPrivate: values.isPrivate,
        file: values.file,
        publish: Boolean(values.file),
        onProgress: setProgress,
      },
      {
        onSuccess: (app) => {
          toast.success(t('web_app_created'));
          resetForm();
          onOpenChange(false);
          onCreated?.(app);
        },
        onError: (err) => setError('root.server', { message: getErrorMessage(err) }),
      },
    );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('create_web_app')}</DialogTitle>
          <DialogDescription>{t('create_web_app_description')}</DialogDescription>
        </DialogHeader>

        <form id="create-web-app" className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="web-app-name">{t('name')}</Label>
            <Input
              id="web-app-name"
              disabled={pending}
              aria-invalid={!!errors.name}
              {...register('name', {
                validate: (value) => !!value.trim() || t('web_app_name_required'),
                // Suggest the slug from the name until the user edits the slug themselves.
                onChange: (event) => {
                  if (!getFieldState('slug').isDirty) setValue('slug', slugify(event.target.value));
                },
              })}
            />
            <FieldError errors={[errors.name]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="web-app-slug">{t('web_app_slug')}</Label>
            <Input
              id="web-app-slug"
              disabled={pending}
              aria-invalid={!!errors.slug}
              {...register('slug', {
                onChange: (event) => {
                  const value: string = event.target.value;
                  if (value !== value.toLowerCase()) setValue('slug', value.toLowerCase(), { shouldDirty: true });
                },
                pattern: { value: SLUG_PATTERN, message: t('web_app_slug_invalid') },
                required: t('web_app_slug_invalid'),
              })}
            />
            <p className="text-xs text-muted-foreground">
              /hr-hub/apps/{slug || '…'}/ — {t('web_app_slug_hint')}
            </p>
            <FieldError errors={[errors.slug]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="web-app-description">{t('description')}</Label>
            <Textarea id="web-app-description" rows={2} disabled={pending} {...register('description')} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('web_app_required_roles')}</Label>
            <Controller
              control={control}
              name="isPrivate"
              render={({ field }) => (
                <PrivateWebAppCheckbox checked={field.value} onChange={field.onChange} disabled={pending} />
              )}
            />
            {!isPrivate && (
              <Controller
                control={control}
                name="roles"
                render={({ field }) => (
                  <RolesInput value={field.value} onChange={field.onChange} disabled={pending} />
                )}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t('web_app_archive_optional')}</Label>
            <Controller
              control={control}
              name="file"
              rules={{
                validate: (value) => !value || isSupportedArchive(value) || t('web_app_archive_unsupported'),
              }}
              render={({ field }) => (
                <WebAppUploadField file={field.value} onChange={field.onChange} disabled={pending} />
              )}
            />
            <FieldError errors={[errors.file]} />
          </div>

          {errors.root?.server && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errors.root.server.message}
            </div>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-w-32"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            {t('cancel')}
          </Button>
          <Button type="submit" form="create-web-app" disabled={pending}>
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
            {pending && file ? `${progress}%` : t('upload_and_publish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
