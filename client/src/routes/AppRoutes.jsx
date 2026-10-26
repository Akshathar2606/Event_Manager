import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import RoleRoute from '../components/auth/RoleRoute';
import AppLayout from '../components/layout/AppLayout';

import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import UnauthorizedPage from '../pages/auth/UnauthorizedPage';
import NotFoundPage from '../pages/NotFoundPage';

import AdminDashboard from '../pages/admin/AdminDashboard';
import OrganizerDashboard from '../pages/organizer/OrganizerDashboard';
import ParticipantDashboard from '../pages/participant/ParticipantDashboard';
import VendorDashboard from '../pages/vendor/VendorDashboard';
import { Loader2 } from 'lucide-react';

/**
 * Root index redirector: Sends authenticated users to their role-specific dashboard,
 * or unauthenticated users to /login.
 */
function RootIndexRedirect() {
  const { isAuthenticated, loading, getHomePath } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">Loading EventFlow...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={getHomePath()} replace />;
  }

  return <Navigate to="/login" replace />;
}

/**
 * Public route wrapper that prevents logged-in users from viewing login/register.
 */
function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading, getHomePath } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={getHomePath()} replace />;
  }

  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Root entry point */}
      <Route path="/" element={<RootIndexRedirect />} />

      {/* Public Authentication Pages */}
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />

      {/* Access Denied / 403 Page */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected Administrator Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['administrator']}>
              <AppLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="venues" element={<AdminDashboard />} />
        <Route path="bookings" element={<AdminDashboard />} />
        <Route path="users" element={<AdminDashboard />} />
      </Route>

      {/* Protected Organizer Routes (Supervisable by Administrator) */}
      <Route
        path="/organizer"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['organizer', 'administrator']}>
              <AppLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<OrganizerDashboard />} />
        <Route path="events" element={<OrganizerDashboard />} />
        <Route path="venues" element={<OrganizerDashboard />} />
        <Route path="catering" element={<OrganizerDashboard />} />
      </Route>

      {/* Protected Participant Routes */}
      <Route
        path="/participant"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['participant', 'administrator']}>
              <AppLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<ParticipantDashboard />} />
        <Route path="registrations" element={<ParticipantDashboard />} />
        <Route path="profile" element={<ParticipantDashboard />} />
      </Route>

      {/* Protected Catering Vendor Routes */}
      <Route
        path="/vendor"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['vendor', 'administrator']}>
              <AppLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<VendorDashboard />} />
        <Route path="menus" element={<VendorDashboard />} />
        <Route path="requests" element={<VendorDashboard />} />
        <Route path="profile" element={<VendorDashboard />} />
      </Route>

      {/* Catch-all 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
