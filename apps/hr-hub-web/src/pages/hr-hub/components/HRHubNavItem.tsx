import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import type { HRHubNavItem as NavItem } from '../config/navigation';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

type Props = {
  item: NavItem;
  collapsed: boolean;
  level?: number;
};

export function HRHubNavItem({ item, collapsed, level = 0 }: Props) {
  const { t } = useTranslation();
  const location = useLocation();

  const hasChildren = !!item.children?.length;

  const isChildActive = hasChildren
    ? item.children!.some(
        (child) =>
          location.pathname === buildPath(child.path) ||
          location.pathname.startsWith(`${buildPath(child.path)}/`),
      )
    : false;

  const isActive = location.pathname === buildPath(item.path);

  const [open, setOpen] = useState(isChildActive);

  const Icon = item.icon;

  const handleClick = () => {
    if (hasChildren) {
      setOpen((value) => {
        if (!value) {
          return !value;
        }
        return value;
      });
    }
  };

  return (
    <div>
      <Link
        to={buildPath(item.path)}
        onClick={handleClick}
        className={[
          'flex h-9 items-center rounded-md text-sm',
          'transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isActive || isChildActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
          collapsed ? 'justify-center px-2' : 'gap-2 px-2',
        ].join(' ')}
        style={!collapsed && level > 0 ? { paddingLeft: `${8 + level * 16}px` } : undefined}
      >
        <Icon className="size-4 shrink-0" />

        {!collapsed && (
          <>
            <span className="flex-1 truncate">{t(item.label)}</span>

            {hasChildren && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('toggle_sub_items')}
                onClick={(ev) => {
                  ev.stopPropagation();
                  ev.preventDefault();
                  setOpen((open) => !open);
                }}
              >
                <ChevronDown
                  className={['size-4 transition-transform', open ? 'rotate-180' : ''].join(' ')}
                />
              </Button>
            )}
          </>
        )}
      </Link>

      {hasChildren && !collapsed && open && (
        <div className="mt-1 space-y-1">
          {item.children!.map((child) => (
            <HRHubNavItem key={child.id} item={child} collapsed={collapsed} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Navigation paths are relative to the HR Hub router.
 *
 * If your HR Hub is mounted at:
 *   /hr-hub
 *
 * this converts:
 *   attendance/settings
 *
 * into:
 *   /hr-hub/attendance/settings
 *
 * Replace this with your actual base path if needed.
 */
function buildPath(path: string): string {
  return `/hr-hub/${path}`.replace(/\/+/g, '/').replace(/\/$/, '');
}
