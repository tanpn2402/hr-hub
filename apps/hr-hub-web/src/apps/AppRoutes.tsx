import { Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { OpenIDConnectCallbackPage } from '@/auth/OpenIDConnectCallbackPage';

import { apps } from './app-registry';
import { useTranslation } from 'react-i18next';
import { lazy, Suspense } from 'react';
import { AppLoadingFallback } from '@/components/app/app-loading-fallback';

const WebAppViewerPage = lazy(() =>
  import('@/pages/web-app-viewer/WebAppViewerPage').then((m) => ({ default: m.WebAppViewerPage })),
);

function appRoute(app: (typeof apps)[number]) {
  const Component = app.component;

  return (
    <Route
      key={app.id}
      path={app.nested ? `${app.href}/*` : app.href}
      element={(
        <Suspense fallback={<AppLoadingFallback />}>
          {app.access?.authenticated ? (
            <ProtectedRoute roles={app.access.roles}>
              <Component />
            </ProtectedRoute>
          ) : (
            <Component />
          )}
        </Suspense>
      )}
    />
  );
}

export function AppRoutes() {
  const { t } = useTranslation();
  return (
    <Routes>
      {/* Authentication infrastructure */}
      <Route path="/hr-hub/auth/openid_connect/callback" element={<OpenIDConnectCallbackPage />} />

      {/* Hosts a published web app in a sandboxed iframe. Static segments (late-attendance) win over :slug. */}
      <Route
        path="/hr-hub/apps/:slug/*"
        element={
          <Suspense fallback={<AppLoadingFallback />}>
            {/* Public apps open anonymously; the viewer sends users to login only when needed. */}
            <WebAppViewerPage />
          </Suspense>
        }
      />

      {apps.map(appRoute)}

      <Route path="*" element={<div>{t('apps_not_found')}</div>} />
    </Routes>
  );
}
