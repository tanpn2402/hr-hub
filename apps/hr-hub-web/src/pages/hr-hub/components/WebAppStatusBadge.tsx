import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';

import type { WebAppStatus } from '../api/web-apps';

const DOT: Record<string, string> = {
  published: 'bg-emerald-500',
  draft: 'bg-amber-500',
  disabled: 'bg-muted-foreground',
};

export function WebAppStatusBadge({ status }: { status: WebAppStatus }) {
  const { t } = useTranslation();

  return (
    <Badge variant="secondary" className="gap-1">
      <span className={`size-1.5 rounded-full ${DOT[status] ?? 'bg-muted-foreground'}`} />
      {t(`web_app_status_${status}`)}
    </Badge>
  );
}
