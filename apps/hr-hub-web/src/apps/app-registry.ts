import { Clock3, LayoutDashboard } from 'lucide-react';
import { lazy, LazyExoticComponent } from 'react';

type AppItem = {
  id: string;
  name: string;
  description?: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  href: string;
  nested?: boolean;
  access?: {
    authenticated?: boolean;
    roles?: string[];
    permissions?: string[];
  };
  component: LazyExoticComponent<() => React.JSX.Element>;
};

const appComponent = <T extends () => React.JSX.Element>(loader: () => Promise<{ default: T }>) =>
  lazy(loader);

export const apps: AppItem[] = [
  {
    id: 'hr-hub',
    name: 'hr_hub',
    description: 'employee_workspace',
    icon: LayoutDashboard,
    href: '/hr-hub/',
    nested: true,
    access: {
      authenticated: true,
      roles: ['HR', 'ADMIN'],
    },
    component: appComponent(() =>
      import('../pages/hr-hub/HRHubPage').then((m) => ({
        default: m.HRHubPage,
      })),
    ),
  },
  {
    id: 'late-hub',
    name: 'late_hub',
    description: 'attendance_and_late_hours',
    icon: Clock3,
    href: '/hr-hub/apps/late-attendance',
    nested: true,
    component: appComponent(() =>
      import('../pages/late-hub/LateHubPage').then((m) => ({
        default: m.LateHubPage,
      })),
    ),
  },
];
