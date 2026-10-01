import { Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { OpenIDConnectCallbackPage } from '@/auth/OpenIDConnectCallbackPage';

import { apps } from './app-registry';
import { useTranslation } from 'react-i18next';
import { Suspense } from 'react';
import { AppLoadingFallback } from '@/components/app/app-loading-fallback';

function appRoute(app: (typeof apps)[number]) {
  const Component = app.component;

  return (
    <Route
      key={app.id}
      path={app.nested ? `${app.href}/*` : app.href}
      element={(
        <Suspense fallback={<AppLoadingFallback />}>
          {app.access?.authenticated ? (
            <ProtectedRoute>
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

      {apps.map(appRoute)}

      <Route path="*" element={<div>{t('apps_not_found')}</div>} />
    </Routes>
  );
}
