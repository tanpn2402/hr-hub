import { Building2, Clock3, Grid2X2, LayoutDashboard } from "lucide-react";
import { HRHubPage } from "../pages/hr-hub/HRHubPage";
import { LateHubPage } from "../pages/late-hub/LateHubPage";

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
  component: () => React.JSX.Element;
};

export const apps: AppItem[] = [
  {
    id: "hr-hub",
    name: "HR Hub",
    description: "Employee workspace",
    icon: LayoutDashboard,
    href: "/hr-hub",
    nested: true,
    access: {
      authenticated: true,
      roles: ["HR", "ADMIN"],
    },
    component: HRHubPage,
  },
  {
    id: "late-hub",
    name: "Late Hub",
    description: "Attendance & late hours",
    icon: Clock3,
    href: "/apps/late-hub",
    nested: true,
    component: LateHubPage,
  },
  {
    id: "app-1",
    name: "App 1",
    description: "Application",
    icon: Building2,
    href: "/apps/app-1",
    access: {
      authenticated: true,
      roles: ["SYSTEM"],
    },
    component: HRHubPage,
  },
  {
    id: "app-2",
    name: "App 2",
    description: "Application",
    icon: Grid2X2,
    href: "/apps/app-2",
    component: HRHubPage,
  },
];
