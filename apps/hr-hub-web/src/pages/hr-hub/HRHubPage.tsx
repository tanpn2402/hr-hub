import { useAuth } from "@/auth/useAuth";

import { HRHubAppShell } from "./layout/HRHubAppShell";
import { Route, Routes } from "react-router-dom";
import { hrHubNavigation } from "./config/navigation";

export function HRHubPage() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <HRHubAppShell
      onLogout={() => void logout()}
    >
      <Routes>
        {hrHubNavigation.map((item) => {
          const Component = item.component;

          return (
            <Route
              key={item.id}
              path={item.path}
              element={<Component />}
            />
          );
        })}
      </Routes>
    </HRHubAppShell>
  );
}