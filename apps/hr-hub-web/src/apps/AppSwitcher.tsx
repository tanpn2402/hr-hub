import {
  Check,
  Grid2X2,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

import { apps } from "./app-registry";

type AppSwitcherProps = {
  currentApp?: string;
};

export function AppSwitcher({
  currentApp = "late-hub",
}: AppSwitcherProps) {

  const handleNavigate = (href: string) => {
    window.location.href = href;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button
        variant="ghost"
        size="icon"
        className="size-9 rounded-lg"
        aria-label="Applications"
      >
        <Grid2X2 className="size-4.5" />
      </Button>} />

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-72 p-2"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2">
            Applications
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <div className="space-y-1">
            {apps.map((app) => {
              const Icon = app.icon;
              const active = app.id === currentApp;

              return (
                <DropdownMenuItem
                  key={app.id}
                  className="cursor-pointer gap-3 rounded-lg p-2.5"
                  onClick={() =>
                    handleNavigate(app.href)
                  }
                  render={<Link to={app.href}>
                    <div
                      className={[
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        active
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      ].join(" ")}
                    >
                      <Icon className="size-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {app.name}
                      </div>

                      {app.description && (
                        <div className="truncate text-xs text-muted-foreground">
                          {app.description}
                        </div>
                      )}
                    </div>

                    {active && (
                      <Check className="size-4 text-primary" />
                    )}
                  </Link>}
                />
              );
            })}
          </div>
        </DropdownMenuGroup>npm install idenplane-sdk

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
