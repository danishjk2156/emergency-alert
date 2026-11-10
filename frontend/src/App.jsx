import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import EmptyState from './components/EmptyState';
import PublicLayout from './components/PublicLayout';
import { ToastProvider } from './components/Toast';
import DashboardPage from './pages/DashboardPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import IncidentsPage from './pages/IncidentsPage';
import LoginPage from './pages/LoginPage';
import ReportPage from './pages/ReportPage';
import ReportSuccessPage from './pages/ReportSuccessPage';
import TrackPage from './pages/TrackPage';

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <EmptyState
        icon="🧭"
        title="Page not found"
        message="The page you’re looking for doesn’t exist."
        action={
          <Link to="/report" className="btn btn-primary">
            Report an emergency
          </Link>
        }
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/report" replace />} />
          <Route element={<PublicLayout />}>
            <Route path="/report" element={<ReportPage />} />
            <Route path="/report/success" element={<ReportSuccessPage />} />
            <Route path="/track" element={<TrackPage />} />
          </Route>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="incidents" element={<IncidentsPage />} />
            <Route path="incidents/:id" element={<IncidentDetailPage />} />
          </Route>
          <Route element={<PublicLayout />}>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
