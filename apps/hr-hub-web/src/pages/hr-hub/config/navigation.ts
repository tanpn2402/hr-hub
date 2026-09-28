import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Settings,
  Users,
  History,
} from "lucide-react";

import { OverviewPage } from "../pages/OverviewPage";
import { EmployeesPage } from "../pages/EmployeesPage";
import { AttendanceLeavePage } from "../pages/AttendanceLeavePage";
import { DocumentsPage } from "../pages/DocumentsPage";
import { AttendanceImportHistoryPage } from "../pages/AttendanceImportHistoryPage";
import { AttendanceSettingsPage } from "../pages/AttendanceSettingsPage";

export type HRHubNavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  component: React.ComponentType;
  children?: HRHubNavItem[];
};

export const hrHubNavigation: HRHubNavItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    path: "",
    component: OverviewPage,
  },
  {
    id: "employees",
    label: "Employees",
    icon: Users,
    path: "employees",
    component: EmployeesPage,
  },
  {
    id: "attendance-leave",
    label: "Attendance & Leave",
    icon: CalendarDays,
    path: "attendance",
    component: AttendanceLeavePage,
    children: [
      {
        id: "attendance-import-history",
        label: "Import History",
        icon: History,
        path: "attendance/import-history",
        component: AttendanceImportHistoryPage,
      },
      {
        id: "attendance-settings",
        label: "Settings",
        icon: Settings,
        path: "attendance/settings",
        component: AttendanceSettingsPage,
      },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    icon: FileText,
    path: "documents",
    component: DocumentsPage,
  },
];
