import { Route, Routes } from 'react-router-dom';
import { lateHubRoutes } from './config/navigation';

export function LateHubPage() {
  return <Routes>{lateHubRoutes.map(renderRoute)}</Routes>;
}

function renderRoute(item: (typeof lateHubRoutes)[number]) {
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

function renderChildRoutes(item: (typeof lateHubRoutes)[number]): React.ReactNode[] {
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
