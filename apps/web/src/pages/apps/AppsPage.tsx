import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { systemAppRegistry } from './app-registry';

export function AppsPage() {
  return (
    <Routes>
      {Object.entries(systemAppRegistry).map(([path, app]) => {
        const Component = app.component;

        return (
          <Route
            key={path}
            path={`${path}/*`}
            element={
              <Suspense fallback={<div>Loading {app.name}...</div>}>
                <Component />
              </Suspense>
            }
          />
        );
      })}

      <Route
        path="*"
        element={<Navigate to="late-hub" replace />}
      />
    </Routes>
  );
}