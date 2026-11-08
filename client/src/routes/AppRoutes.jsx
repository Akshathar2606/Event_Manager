import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import RoleRoute from '../components/auth/RoleRoute';
import AppLayout from '../components/layout/AppLayout';

import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import UnauthorizedPage from '../pages/auth/UnauthorizedPage';
import NotFoundPage from '../pages/NotFoundPage';

import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminEventsPage from '../pages/admin/AdminEventsPage';
import AdminVenuesPage from '../pages/admin/AdminVenuesPage';
import AdminBookingsPage from '../pages/admin/AdminBookingsPage';
import AdminUsersPage from '../pages/admin/AdminUsersPage';
import OrganizerDashboard from '../pages/organizer/OrganizerDashboard';
import OrganizerEventsPage from '../pages/organizer/OrganizerEventsPage';
import OrganizerEventAttendeesPage from '../pages/organizer/OrganizerEventAttendeesPage';
import OrganizerVenuesPage from '../pages/organizer/OrganizerVenuesPage';
import OrganizerBookingsPage from '../pages/organizer/OrganizerBookingsPage';
import OrganizerCateringPage from '../pages/organizer/OrganizerCateringPage';
import OrganizerCateringRequestsPage from '../pages/organizer/OrganizerCateringRequestsPage';
import ParticipantDashboard from '../pages/participant/ParticipantDashboard';
import ParticipantEventsPage from '../pages/participant/ParticipantEventsPage';
import ParticipantRegistrationsPage from '../pages/participant/ParticipantRegistrationsPage';
import VendorDashboard from '../pages/vendor/VendorDashboard';
import VendorProfilePage from '../pages/vendor/VendorProfilePage';
import VendorPackagesPage from '../pages/vendor/VendorPackagesPage';
import VendorCateringRequestsPage from '../pages/vendor/VendorCateringRequestsPage';
import VendorApplicationStatusPage from '../pages/vendor/VendorApplicationStatusPage';
import AdminVendorApplicationsPage from '../pages/admin/AdminVendorApplicationsPage';
import UserProfilePage from '../pages/profile/UserProfilePage';
import LandingPage from '../pages/public/LandingPage';
import { USER_ROLES } from '../utils/roles';
import { Loader2 } from 'lucide-react';

/**
 * Authenticated users go to their role workspace; public visitors see the landing page.
 */
function RootIndexRedirect() {
  const { isAuthenticated, loading, getHomePath } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm text-text-muted font-medium">Loading EventFlow...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={getHomePath()} replace />;
  }

  return <LandingPage />;
}

/**
 * Public route wrapper that prevents logged-in users from viewing login/register.
 */
function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading, getHomePath } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={getHomePath()} replace />;
  }

  return children;
}

function VendorApprovalRoute({ children }) {
  const { user } = useAuth();
  if (
    user?.role === 'vendor' &&
    user.vendorApplicationStatus !== 'approved'
  ) {
    return <Navigate to="/vendor/application-status" replace />;
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
      <Route
        path="/forgot-password"
        element={<ForgotPasswordPage />}
      />
      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />

      {/* Access Denied / 403 Page */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={USER_ROLES}>
              <AppLayout />
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<UserProfilePage />} />
      </Route>

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
        <Route path="events" element={<AdminEventsPage />} />
        <Route path="venues" element={<AdminVenuesPage />} />
        <Route path="bookings" element={<AdminBookingsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="vendor-applications" element={<AdminVendorApplicationsPage />} />
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
        <Route path="events" element={<OrganizerEventsPage />} />
        <Route path="events/:id/attendees" element={<OrganizerEventAttendeesPage />} />
        <Route path="venues" element={<OrganizerVenuesPage />} />
        <Route path="bookings" element={<OrganizerBookingsPage />} />
        <Route path="catering" element={<OrganizerCateringPage />} />
        <Route path="catering-requests" element={<OrganizerCateringRequestsPage />} />
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
        <Route index element={<ParticipantEventsPage />} />
        <Route path="events" element={<ParticipantEventsPage />} />
        <Route path="dashboard" element={<ParticipantDashboard />} />
        <Route path="registrations" element={<ParticipantRegistrationsPage />} />
        <Route path="profile" element={<ParticipantDashboard />} />
      </Route>

      <Route
        path="/vendor/application-status"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['vendor']}>
              <VendorApplicationStatusPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Protected Catering Vendor Routes */}
      <Route
        path="/vendor"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={['vendor', 'administrator']}>
              <VendorApprovalRoute>
                <AppLayout />
              </VendorApprovalRoute>
            </RoleRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<VendorDashboard />} />
        <Route path="menus" element={<VendorPackagesPage />} />
        <Route path="requests" element={<VendorCateringRequestsPage />} />
        <Route path="profile" element={<VendorProfilePage />} />
      </Route>

      {/* Catch-all 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
