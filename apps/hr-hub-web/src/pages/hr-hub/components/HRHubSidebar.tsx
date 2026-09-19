import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/ui/button";

import { hrHubNavigation } from "../config/navigation";
import { HRHubNavItem } from "./HRHubNavItem";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

export function HRHubSidebar({
  collapsed,
  onToggle,
}: Props) {
  return (
    <aside
      className={[
        "hidden shrink-0 border-r bg-background md:flex md:flex-col",
        "transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16" : "w-60",
      ].join(" ")}
    >
      {/* Sidebar header */}
      <div
        className={[
          "flex h-14 items-center border-b",
          collapsed ? "justify-center px-2" : "justify-between px-3",
        ].join(" ")}
      >
        {!collapsed && (
          <div className="px-2">
            <div className="text-sm font-semibold">
              HR Hub
            </div>
            <div className="text-xs text-muted-foreground">
              Human Resources
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {!collapsed && (
          <div className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Workspace
          </div>
        )}

        {hrHubNavigation.map((item) => (
          <HRHubNavItem
            key={item.id}
            item={item}
            collapsed={collapsed}
          />
        ))}
      </nav>
    </aside>
  );
}