import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import AppShell from './components/layout/AppShell';
import LandingPage from './pages/LandingPage';
import ExplorePage from './pages/ExplorePage';
import CreatorProfilePage from './pages/CreatorProfilePage';
import LockedContentPage from './pages/LockedContentPage';
import AuthPage from './pages/AuthPage';
import PendingAccessPage from './pages/PendingAccessPage';
import AccessDeniedPage from './pages/AccessDeniedPage';
import MemberDashboard from './pages/MemberDashboard';
import CreatorDashboard from './pages/CreatorDashboard';
import CreatorApplicationPage from './pages/CreatorApplicationPage';
import UploadContent from './pages/UploadContent';
import MessagesPage from './pages/MessagesPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminControlCenter from './pages/AdminControlCenter';
import AccessKeysPage from './pages/AccessKeysPage';
import CreatorOnboarding from './pages/CreatorOnboarding';
import NotificationsPage from './pages/NotificationsPage';
import StaticPage from './pages/StaticPage';
import SetPasswordPage from './pages/SetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import PaymentResultPage from './pages/PaymentResultPage';

// Requires: authenticated. If pending/rejected/suspended/banned → redirect to appropriate page.
// If requireApproved: must have status=approved.
// If requireCreator: must be approved + creator role.
// If requireAdmin: must be admin role.
function ProtectedRoute({
  children,
  requireApproved = true,
  requireCreator,
  requireAdmin,
}: {
  children: React.ReactNode;
  requireApproved?: boolean;
  requireCreator?: boolean;
  requireAdmin?: boolean;
}) {
  const { isAuthenticated, isCreator, isAdmin, userStatus } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Admin bypasses all status gates
  if (isAdmin) {
    return <>{children}</>;
  }

  // Status gates (apply to all non-admin users)
  if (requireApproved) {
    if (userStatus === 'pending') return <Navigate to="/pending" replace />;
    if (userStatus === 'rejected' || userStatus === 'suspended' || userStatus === 'banned') {
      return <Navigate to="/access-denied" replace />;
    }
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireCreator && !isCreator) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        {/* Public */}
        <Route index element={<LandingPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="creator/:username" element={<CreatorProfilePage />} />
        <Route path="content/:id" element={<LockedContentPage />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="signup" element={<AuthPage mode="signup" />} />
        <Route path="request-access" element={<AuthPage mode="signup" />} />
        <Route path="set-password" element={<SetPasswordPage />} />
        <Route path="privacy" element={<StaticPage page="privacy" />} />
        <Route path="terms" element={<StaticPage page="terms" />} />
        <Route path="compliance" element={<StaticPage page="compliance" />} />
        <Route path="dmca" element={<StaticPage page="dmca" />} />
        <Route path="age-verification" element={<StaticPage page="age-verification" />} />
        <Route path="contact" element={<StaticPage page="contact" />} />
        <Route path="report" element={<StaticPage page="report" />} />
        <Route path="help" element={<StaticPage page="help" />} />

        {/* Status-gated pages — authenticated but no approval required */}
        <Route path="pending" element={
          <ProtectedRoute requireApproved={false}>
            <PendingAccessPage />
          </ProtectedRoute>
        } />
        <Route path="access-denied" element={
          <ProtectedRoute requireApproved={false}>
            <AccessDeniedPage />
          </ProtectedRoute>
        } />

        {/* Approved members */}
        <Route path="dashboard" element={
          <ProtectedRoute>
            <MemberDashboard />
          </ProtectedRoute>
        } />
        <Route path="messages" element={
          <ProtectedRoute>
            <MessagesPage />
          </ProtectedRoute>
        } />
        <Route path="apply-creator" element={
          <ProtectedRoute>
            <CreatorApplicationPage />
          </ProtectedRoute>
        } />
        <Route path="keys" element={
          <ProtectedRoute>
            <AccessKeysPage />
          </ProtectedRoute>
        } />
        <Route path="notifications" element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        } />
        <Route path="success" element={
          <ProtectedRoute>
            <PaymentResultPage type="success" />
          </ProtectedRoute>
        } />
        <Route path="cancel" element={
          <ProtectedRoute>
            <PaymentResultPage type="cancel" />
          </ProtectedRoute>
        } />

        {/* Approved creators */}
        <Route path="creator" element={
          <ProtectedRoute requireCreator>
            <CreatorDashboard />
          </ProtectedRoute>
        } />
        <Route path="creator/dashboard" element={
          <ProtectedRoute requireCreator>
            <CreatorDashboard />
          </ProtectedRoute>
        } />
        <Route path="upload" element={
          <ProtectedRoute requireCreator>
            <UploadContent />
          </ProtectedRoute>
        } />
        <Route path="creator/onboarding" element={
          <ProtectedRoute requireCreator>
            <CreatorOnboarding />
          </ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="admin" element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="admin/access-requests" element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard initialTab="access-requests" />
          </ProtectedRoute>
        } />
        <Route path="admin/content-approvals" element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard initialTab="content-approvals" />
          </ProtectedRoute>
        } />
        <Route path="admin/creator-approvals" element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard initialTab="creator-approvals" />
          </ProtectedRoute>
        } />
        <Route path="admin/flagged" element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard initialTab="flagged" />
          </ProtectedRoute>
        } />
        <Route path="admin/transactions" element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard initialTab="transactions" />
          </ProtectedRoute>
        } />
        <Route path="admin/keys" element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard initialTab="keys" />
          </ProtectedRoute>
        } />
        <Route path="admin/control-center" element={
          <ProtectedRoute requireAdmin>
            <AdminControlCenter />
          </ProtectedRoute>
        } />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
