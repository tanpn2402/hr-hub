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

import {
  getErrorMessage,
  type InspectedPackage,
  type SettingValues,
  type WebApp,
} from '../api/web-apps';
import { useCreateWebApp } from '../hooks/useWebApps';
import { PrivateWebAppCheckbox } from './PrivateWebAppCheckbox';
import { RolesInput } from './RolesInput';
import { WebAppPackageField } from './WebAppPackageField';
import { initialSettings, missingSettings, WebAppSettingsFields } from './WebAppSettingsFields';

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
};

const DEFAULT_VALUES: FormValues = {
  name: '',
  slug: '',
  description: '',
  roles: [],
  isPrivate: false,
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
  // The package, already uploaded and validated (inspect), and the values for the settings it declares.
  const [pkg, setPkg] = useState<InspectedPackage | null>(null);
  const [settings, setSettings] = useState<SettingValues>({});
  const [showSettingErrors, setShowSettingErrors] = useState(false);

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
  const schema = pkg?.manifest?.settings ?? {};

  const resetForm = () => {
    reset(DEFAULT_VALUES);
    setPkg(null);
    setSettings({});
    setShowSettingErrors(false);
  };

  /** Fills the form from hrhub.json, without overwriting what the admin already typed. */
  const onPackage = (next: InspectedPackage | null) => {
    setPkg(next);
    setSettings(initialSettings(next?.manifest?.settings ?? {}));
    setShowSettingErrors(false);
    const manifest = next?.manifest;
    if (!manifest) return;
    if (manifest.name && !getFieldState('name').isDirty)
      setValue('name', manifest.name, { shouldValidate: true });
    if (manifest.description && !getFieldState('description').isDirty)
      setValue('description', manifest.description);
    if (!getFieldState('slug').isDirty) {
      const suggested = manifest.slug ?? (manifest.name ? slugify(manifest.name) : '');
      if (suggested) setValue('slug', suggested, { shouldValidate: true });
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (pending) return;
    if (!value) resetForm();
    onOpenChange(value);
  };

  // Required settings still empty (e.g. two apps that point at each other: the other one does not exist yet): the
  // app is created as a draft, and published from its page once the settings are filled in.
  const incomplete = Boolean(pkg) && missingSettings(schema, settings).length > 0;

  const onSubmit = (values: FormValues) => {
    setShowSettingErrors(incomplete);
    createMutation.mutate(
      {
        name: values.name,
        slug: values.slug,
        description: values.description,
        requiredRoles: values.isPrivate ? [] : values.roles,
        isPrivate: values.isPrivate,
        stagingToken: pkg?.token,
        settings: pkg ? settings : undefined,
        publish: Boolean(pkg) && !incomplete,
      },
      {
        onSuccess: (app) => {
          if (incomplete) toast.info(t('web_app_created_draft'));
          else toast.success(t('web_app_created'));
          resetForm();
          onOpenChange(false);
          onCreated?.(app);
        },
        onError: (err) => setError('root.server', { message: getErrorMessage(err) }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('create_web_app')}</DialogTitle>
          <DialogDescription>{t('create_web_app_description')}</DialogDescription>
        </DialogHeader>

        <form
          id="create-web-app"
          className="space-y-4"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <div className="space-y-1.5">
            <Label>{t('web_app_archive_optional')}</Label>
            <WebAppPackageField value={pkg} onChange={onPackage} disabled={pending} />
          </div>

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
                  if (value !== value.toLowerCase())
                    setValue('slug', value.toLowerCase(), { shouldDirty: true });
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
            <Textarea
              id="web-app-description"
              rows={2}
              disabled={pending}
              {...register('description')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('web_app_required_roles')}</Label>
            <Controller
              control={control}
              name="isPrivate"
              render={({ field }) => (
                <PrivateWebAppCheckbox
                  checked={field.value}
                  onChange={field.onChange}
                  disabled={pending}
                />
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

          {Object.keys(schema).length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">{t('web_app_settings')}</div>
                <p className="text-xs text-muted-foreground">{t('web_app_settings_hint')}</p>
              </div>
              <WebAppSettingsFields
                schema={schema}
                values={settings}
                onChange={setSettings}
                disabled={pending}
                selfSlug={slug}
                showErrors={showSettingErrors}
              />
            </div>
          )}

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
            {pending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Upload className="mr-2 size-4" />
            )}
            {pkg && !incomplete ? t('upload_and_publish') : t('create_web_app_draft')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
