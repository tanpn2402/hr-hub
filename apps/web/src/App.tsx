import { Route, Routes } from 'react-router-dom';
import HRHubPage from './pages/hr-hub/HRHubPage';
import { AppsPage } from './pages/apps/AppsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/apps/*" element={<AppsPage />} />

      <Route
        path="/"
        element={<HRHubPage />}
      />

      <Route
        path="*"
        element={<div>Page not found</div>}
      />
    </Routes>
  );
}