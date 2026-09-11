import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import IncidentDetail from './pages/IncidentDetail';
import Cameras from './pages/Cameras';

/**
 * App — top-level router.
 *
 * Routes:
 *   /             → Dashboard (incident feed)
 *   /upload       → Upload video
 *   /incidents/:id → Incident detail
 *   /cameras      → Camera/zone list
 *   *             → Redirect to /
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/upload"        element={<Upload />} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
          <Route path="/cameras"       element={<Cameras />} />
          {/* Catch-all → Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
