import { AppSwitcher } from "../../../apps/AppSwitcher";
import { HRHubUserMenu } from "./HRHubUserMenu";
import { useTranslation } from "react-i18next";

type Props = {
  onLogout: () => void;
};

export function HRHubHeader({ onLogout }: Props) {
  const { t } = useTranslation();
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div className="flex min-w-0 items-center gap-2">
        <AppSwitcher currentApp="hr-hub" />

        <div className="h-5 w-px bg-border" />

        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-base font-semibold">
            {t("hr_hub")}
          </h1>

          <span className="hidden text-sm text-muted-foreground sm:inline">
            {t("portal")}
          </span>
        </div>
      </div>

      <HRHubUserMenu onLogout={onLogout} />
    </header>
  );
}