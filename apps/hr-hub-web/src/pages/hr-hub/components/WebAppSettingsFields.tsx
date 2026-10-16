import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import type { SettingDefinition, SettingsSchema, SettingValues } from '../api/web-apps';
import { useWebApps } from '../hooks/useWebApps';

type Props = {
  schema: SettingsSchema;
  values: SettingValues;
  onChange: (values: SettingValues) => void;
  disabled?: boolean;
  /** Slug of the app being configured, left out of "app" pickers. */
  selfSlug?: string;
  /** Show "required" errors (after a submit attempt). */
  showErrors?: boolean;
};

const isEmpty = (value: unknown) => value === null || value === undefined || value === '';

/** Keys of required settings without a value (defaults count as values). */
export function missingSettings(schema: SettingsSchema, values: SettingValues): string[] {
  return Object.entries(schema)
    .filter(
      ([key, definition]) =>
        definition.required && isEmpty(values[key]) && isEmpty(definition.default),
    )
    .map(([key]) => key);
}

/** Initial values: what is stored, else the declared default. */
export function initialSettings(schema: SettingsSchema, stored: SettingValues = {}): SettingValues {
  return Object.fromEntries(
    Object.entries(schema).map(([key, definition]) => [
      key,
      stored[key] ?? definition.default ?? null,
    ]),
  );
}

/**
 * Inputs for the settings an app declares in hrhub.json ("settings"). The values are per app and survive new
 * versions; "app" settings let an app refer to another app without hard-coding its slug.
 */
export function WebAppSettingsFields({
  schema,
  values,
  onChange,
  disabled,
  selfSlug,
  showErrors,
}: Props) {
  const { t } = useTranslation();
  const entries = Object.entries(schema);
  if (entries.length === 0) return null;
  const missing = new Set(showErrors ? missingSettings(schema, values) : []);
  const set = (key: string, value: SettingValues[string]) => onChange({ ...values, [key]: value });

  return (
    <div className="space-y-3">
      {entries.map(([key, definition]) => (
        <div key={key} className="space-y-1.5">
          {definition.type !== 'boolean' && (
            <Label htmlFor={`setting-${key}`}>
              {definition.label}
              {definition.required && <span className="text-destructive"> *</span>}
              <span className="ml-1.5 font-mono text-[10px] font-normal text-muted-foreground">
                {key}
              </span>
            </Label>
          )}
          <SettingInput
            id={`setting-${key}`}
            definition={definition}
            value={values[key] ?? null}
            onChange={(value) => set(key, value)}
            disabled={disabled}
            selfSlug={selfSlug}
            invalid={missing.has(key)}
          />
          {definition.description && (
            <p className="text-xs text-muted-foreground">{definition.description}</p>
          )}
          {missing.has(key) && (
            <p className="text-xs text-destructive">{t('web_app_setting_required')}</p>
          )}
        </div>
      ))}
    </div>
  );
}

type InputProps = {
  id: string;
  definition: SettingDefinition;
  value: SettingValues[string];
  onChange: (value: SettingValues[string]) => void;
  disabled?: boolean;
  selfSlug?: string;
  invalid?: boolean;
};

function SettingInput({
  id,
  definition,
  value,
  onChange,
  disabled,
  selfSlug,
  invalid,
}: InputProps) {
  const { t } = useTranslation();
  const apps = useWebApps();

  switch (definition.type) {
    case 'app': {
      const items = (apps.data ?? [])
        .filter((app) => app.slug !== selfSlug && app.status !== 'deleted')
        .map((app) => ({ value: app.slug, label: `${app.name} (${app.slug})` }));
      // A stored slug whose app is gone still shows (so the admin sees what to fix).
      if (typeof value === 'string' && value && !items.some((item) => item.value === value)) {
        items.unshift({ value, label: `${value} — ${t('web_app_setting_app_missing')}` });
      }
      return (
        <Select
          value={(value as string) || null}
          items={items}
          onValueChange={(next) => onChange(next ?? null)}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
            <SelectValue placeholder={t('web_app_setting_choose_app')} />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    case 'select':
      return (
        <Select
          value={(value as string) || null}
          items={definition.options}
          onValueChange={(next) => onChange(next ?? null)}
          disabled={disabled}
        >
          <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {definition.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'boolean':
      return (
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <Checkbox
            id={id}
            checked={value === true}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          {definition.label}
        </label>
      );
    case 'number':
      return (
        <Input
          id={id}
          type="number"
          min={definition.min ?? undefined}
          max={definition.max ?? undefined}
          value={value === null ? '' : String(value)}
          disabled={disabled}
          aria-invalid={invalid}
          onChange={(event) =>
            onChange(event.target.value === '' ? null : Number(event.target.value))
          }
        />
      );
    case 'text':
      return (
        <Textarea
          id={id}
          rows={3}
          value={(value as string) ?? ''}
          disabled={disabled}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    default:
      return (
        <Input
          id={id}
          value={(value as string) ?? ''}
          disabled={disabled}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}
