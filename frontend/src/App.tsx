import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import IncidentDetail from './pages/IncidentDetail';
import Cameras from './pages/Cameras';
import Settings from './pages/Settings';

import { ToastProvider } from './hooks/useToast';
import { ThemeProvider } from './components/ThemeProvider';

/**
 * App — top-level router.
 */
export default function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/"              element={<Dashboard />} />
              <Route path="/upload"        element={<Upload />} />
              <Route path="/incidents/:id" element={<IncidentDetail />} />
              <Route path="/cameras"       element={<Cameras />} />
              <Route path="/settings"      element={<Settings />} />
              {/* Catch-all → Dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
