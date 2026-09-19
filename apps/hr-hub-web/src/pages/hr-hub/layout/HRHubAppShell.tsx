import { useState } from "react";

import { HRHubHeader } from "../components/HRHubHeader";
import { HRHubSidebar } from "../components/HRHubSidebar";

type Props = {
  children: React.ReactNode;
  onLogout: () => void;
};

export function HRHubAppShell({
  children,
  onLogout,
}: Props) {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background">
      <HRHubHeader onLogout={onLogout} />

      <div className="flex min-h-0 flex-1">
        <HRHubSidebar
          collapsed={sidebarCollapsed}
          onToggle={() =>
            setSidebarCollapsed((value) => !value)
          }
        />

        <main className="min-w-0 flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}