import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { hrHubNavigation } from '../config/navigation';
import { HRHubNavItem } from './HRHubNavItem';
import { useTranslation } from 'react-i18next';

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

export function HRHubSidebar({ collapsed, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <aside
      className={[
        'hidden shrink-0 border-r bg-background md:flex md:flex-col',
        'transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
      ].join(' ')}
    >
      {/* Sidebar header */}
      <div
        className={[
          'flex h-14 items-center border-b',
          collapsed ? 'justify-center px-2' : 'justify-between px-3',
        ].join(' ')}
      >
        {!collapsed && (
          <div className="px-2">
            <div className="text-sm font-semibold">{t('hr_hub')}</div>
            <div className="text-xs text-muted-foreground">{t('human_resources')}</div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onToggle}
          aria-label={collapsed ? t('expand_sidebar') : t('collapse_sidebar')}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {!collapsed && (
          <div className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {t('workspace')}
          </div>
        )}

        {hrHubNavigation.map((item) => (
          <HRHubNavItem key={item.id} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
}
