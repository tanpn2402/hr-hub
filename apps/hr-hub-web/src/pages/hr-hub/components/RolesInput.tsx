import { X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

type Props = {
  value: string[];
  onChange: (roles: string[]) => void;
  disabled?: boolean;
};

/** Free-form role tags. Press Enter or comma to add; an empty list means every signed-in user. */
export function RolesInput({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  const commit = () => {
    const role = draft.trim().replace(/,$/, '');
    setDraft('');
    if (role && !value.includes(role)) onChange([...value, role]);
  };

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        disabled={disabled}
        placeholder={t('web_app_roles_placeholder')}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            commit();
          }
        }}
      />

      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t('web_app_roles_public_hint')}</span>
        ) : (
          value.map((role) => (
            <Badge key={role} variant="secondary" className="gap-1">
              {role}
              <button
                type="button"
                disabled={disabled}
                aria-label={t('remove')}
                onClick={() => onChange(value.filter((item) => item !== role))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
