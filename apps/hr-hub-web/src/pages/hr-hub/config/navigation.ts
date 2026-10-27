import {
  CalendarDays,
  LayoutDashboard,
  Settings,
  Users,
  History,
  CreditCard,
  AppWindow,
  Globe,
  ShieldCheck,
} from 'lucide-react';

import { OverviewPage } from '../pages/OverviewPage';
import { EmployeesPage } from '../pages/EmployeesPage';
import { IdentityPage } from '../pages/IdentityPage';
import { AttendanceLeavePage } from '../pages/AttendanceLeavePage';
import { AttendanceImportHistoryPage } from '../pages/AttendanceImportHistoryPage';
import { AttendanceSettingsPage } from '../pages/AttendanceSettingsPage';
import { FinePaymentHistoryPage } from '../pages/FinePaymentHistoryPage';
import { WebAppsPage } from '../pages/WebAppsPage';
import { WebAppDetailPage } from '../pages/WebAppDetailPage';
import { WebAppAccessRequestsPage } from '../pages/WebAppAccessRequestsPage';

export type HRHubNavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  component: React.ComponentType;
  /** Routed but not shown in the sidebar (e.g. detail pages). */
  hidden?: boolean;
  children?: HRHubNavItem[];
};

export const hrHubNavigation: HRHubNavItem[] = [
  {
    id: 'overview',
    label: 'overview',
    icon: LayoutDashboard,
    path: '',
    component: OverviewPage,
  },
  {
    id: 'employees',
    label: 'employees',
    icon: Users,
    path: 'employees',
    component: EmployeesPage,
    children: [
      {
        id: 'employees-master-data',
        label: 'master_data',
        icon: Users,
        path: 'employees',
        component: EmployeesPage,
      },
      {
        id: 'integrated-identity',
        label: 'integrated_identity',
        icon: Users,
        path: 'employees/identity',
        component: IdentityPage,
      },
    ],
  },
  {
    id: 'attendance-leave',
    label: 'attendance_and_leave',
    icon: CalendarDays,
    path: 'attendance',
    component: AttendanceLeavePage,
    children: [
      {
        id: 'attendance-import-history',
        label: 'import_history',
        icon: History,
        path: 'attendance/import-history',
        component: AttendanceImportHistoryPage,
      },
      {
        id: 'fine-payment-history',
        label: 'fine_payment_history',
        icon: CreditCard,
        path: 'attendance/fine-payment-history',
        component: FinePaymentHistoryPage,
      },
      {
        id: 'attendance-settings',
        label: 'settings',
        icon: Settings,
        path: 'attendance/settings',
        component: AttendanceSettingsPage,
      },
    ],
  },
  // {
  //   id: 'documents',
  //   label: 'documents',
  //   icon: FileText,
  //   path: 'documents',
  //   component: DocumentsPage,
  // },
  {
    id: 'apps',
    label: 'apps',
    icon: AppWindow,
    path: 'apps-admin',
    component: WebAppsPage,
    children: [
      {
        id: 'web-apps',
        label: 'web_apps',
        icon: Globe,
        path: 'apps-admin',
        component: WebAppsPage,
      },
      {
        id: 'manage-access',
        label: 'manage_access',
        icon: ShieldCheck,
        path: 'apps-admin/manage-access',
        component: WebAppAccessRequestsPage,
      },
      {
        id: 'web-app-detail',
        label: 'web_apps',
        icon: Globe,
        path: 'apps-admin/web-apps/:id',
        component: WebAppDetailPage,
        hidden: true,
      },
    ],
  },
];
