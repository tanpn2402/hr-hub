import { useAuth } from '@/auth/useAuth';
import { Route, Routes } from 'react-router-dom';

import { hrHubNavigation } from './config/navigation';
import { HRHubAppShell } from './layout/HRHubAppShell';

export function HRHubPage() {
  const { logout } = useAuth();

  return (
    <HRHubAppShell onLogout={() => void logout()}>
      <Routes>{hrHubNavigation.map(renderRoute)}</Routes>
    </HRHubAppShell>
  );
}

function renderRoute(item: (typeof hrHubNavigation)[number]) {
  const routes = [];

  if (item.component) {
    const Component = item.component;

    routes.push(<Route key={item.id} path={item.path} element={<Component />} />);
  }

  if (item.children) {
    for (const child of item.children) {
      routes.push(...renderChildRoutes(child));
    }
  }

  return routes;
}

function renderChildRoutes(item: (typeof hrHubNavigation)[number]): React.ReactNode[] {
  const routes: React.ReactNode[] = [];

  if (item.component) {
    const Component = item.component;

    routes.push(<Route key={item.id} path={item.path} element={<Component />} />);
  }

  if (item.children) {
    for (const child of item.children) {
      routes.push(...renderChildRoutes(child));
    }
  }

  return routes;
}
