import { Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { OpenIDConnectCallbackPage } from "@/auth/OpenIDConnectCallbackPage";

import { apps } from "./app-registry";

function appRoute(app: (typeof apps)[number]) {
  const Component = app.component;
  const page = <Component />;

  return (
    <Route
      key={app.id}
      path={app.nested ? `${app.href}/*` : app.href}
      element={
        app.access?.authenticated ? (
          <ProtectedRoute>{page}</ProtectedRoute>
        ) : (
          page
        )
      }
    />
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Authentication infrastructure */}
      <Route
        path="/auth/openid_connect/callback"
        element={<OpenIDConnectCallbackPage />}
      />

      {apps.map(appRoute)}

      <Route
        path="*"
        element={<div>Apps not found</div>}
      />
    </Routes>
  );
}
