import { CalendarDays, FileText, LayoutDashboard, Users } from "lucide-react";

import { OverviewPage } from "../pages/OverviewPage";
import { EmployeesPage } from "../pages/EmployeesPage";
import { AttendanceLeavePage } from "../pages/AttendanceLeavePage";
import { DocumentsPage } from "../pages/DocumentsPage";

export type HRHubNavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  component: React.ComponentType;
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
  },
  {
    id: "documents",
    label: "Documents",
    icon: FileText,
    path: "documents",
    component: DocumentsPage,
  },
];
