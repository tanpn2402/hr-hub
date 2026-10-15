import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

/** "Only me" toggle: when checked the app is visible to its creator only and the required roles are ignored. */
export function PrivateWebAppCheckbox({ checked, onChange, disabled }: Props) {
  const { t } = useTranslation();

  return (
    <label className="flex cursor-pointer items-start gap-2">
      <Checkbox
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{t('web_app_private')}</span>
        <span className="block text-xs text-muted-foreground">{t('web_app_private_hint')}</span>
      </span>
    </label>
  );
}
