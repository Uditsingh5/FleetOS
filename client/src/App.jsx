import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layouts
import MainLayout from './layouts/MainLayout';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Admin Pages
import AdminOverview from './pages/admin/AdminOverview';
import AdminLiveOperations from './pages/admin/AdminLiveOperations';
import AdminRequests from './pages/admin/AdminRequests';
import AdminFleet from './pages/admin/AdminFleet';
import AdminDrivers from './pages/admin/AdminDrivers';
import AdminTasks from './pages/admin/AdminTasks';
import AdminScarcityMap from './pages/admin/AdminScarcityMap';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';

// Citizen Pages
import CitizenHome from './pages/citizen/CitizenHome';
import CitizenReportRequest from './pages/citizen/CitizenReportRequest';
import CitizenMyRequests from './pages/citizen/CitizenMyRequests';
import CitizenLiveTracking from './pages/citizen/CitizenLiveTracking';

// Driver Pages
import DriverDashboard from './pages/driver/DriverDashboard';
import DriverActiveTask from './pages/driver/DriverActiveTask';
import DriverVehicle from './pages/driver/DriverVehicle';
import DriverTaskHistory from './pages/driver/DriverTaskHistory';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
    if (user.role === 'DRIVER') return <Navigate to="/driver" replace />;
    return <Navigate to="/citizen" replace />;
  }

  return children;
}

function RoleRootRedirect() {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'DRIVER') return <Navigate to="/driver" replace />;
  return <Navigate to="/citizen" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected App Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleRootRedirect />} />

          {/* Admin Routes */}
          <Route
            path="admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminOverview />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/live"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminLiveOperations />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/requests"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/fleet"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminFleet />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/drivers"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminDrivers />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/tasks"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminTasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/scarcity"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminScarcityMap />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/analytics"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminAnalytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/audit"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                <AdminAuditLogs />
              </ProtectedRoute>
            }
          />

          {/* Citizen Routes */}
          <Route
            path="citizen"
            element={
              <ProtectedRoute allowedRoles={['CITIZEN']}>
                <CitizenHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="citizen/report"
            element={
              <ProtectedRoute allowedRoles={['CITIZEN']}>
                <CitizenReportRequest />
              </ProtectedRoute>
            }
          />
          <Route
            path="citizen/requests"
            element={
              <ProtectedRoute allowedRoles={['CITIZEN']}>
                <CitizenMyRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="citizen/tracking"
            element={
              <ProtectedRoute allowedRoles={['CITIZEN']}>
                <CitizenLiveTracking />
              </ProtectedRoute>
            }
          />

          {/* Driver Routes */}
          <Route
            path="driver"
            element={
              <ProtectedRoute allowedRoles={['DRIVER']}>
                <DriverDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="driver/active-task"
            element={
              <ProtectedRoute allowedRoles={['DRIVER']}>
                <DriverActiveTask />
              </ProtectedRoute>
            }
          />
          <Route
            path="driver/vehicle"
            element={
              <ProtectedRoute allowedRoles={['DRIVER']}>
                <DriverVehicle />
              </ProtectedRoute>
            }
          />
          <Route
            path="driver/history"
            element={
              <ProtectedRoute allowedRoles={['DRIVER']}>
                <DriverTaskHistory />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
