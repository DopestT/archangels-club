import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SavedProvider } from './context/SavedContext';
import { ToastProvider } from './components/ui/Toast';
import { LanguageProvider } from './context/LanguageContext';
import { FeatureFlagsProvider } from './context/FeatureFlagsContext';
import AppShell from './components/layout/AppShell';
import SplashScreen from './components/brand/SplashScreen';
import ErrorBoundary from './components/ErrorBoundary';

const LandingPage              = lazy(() => import('./pages/LandingPage'));
const ExplorePage              = lazy(() => import('./pages/ExplorePage'));
const CreatorProfilePage       = lazy(() => import('./pages/CreatorProfilePage'));
const LockedContentPage        = lazy(() => import('./pages/LockedContentPage'));
const AuthPage                 = lazy(() => import('./pages/AuthPage'));
const PendingAccessPage        = lazy(() => import('./pages/PendingAccessPage'));
const AccessDeniedPage         = lazy(() => import('./pages/AccessDeniedPage'));
const MemberDashboard          = lazy(() => import('./pages/MemberDashboard'));
const CreatorDashboard         = lazy(() => import('./pages/CreatorDashboard'));
const CreatorApplicationPage   = lazy(() => import('./pages/CreatorApplicationPage'));
const UploadContent            = lazy(() => import('./pages/UploadContent'));
const MessagesPage             = lazy(() => import('./pages/MessagesPage'));
const AdminDashboard           = lazy(() => import('./pages/AdminDashboard'));
const AdminControlCenter       = lazy(() => import('./pages/AdminControlCenter'));
const BugControlPage           = lazy(() => import('./pages/BugControlPage'));
const CreatorOnboarding        = lazy(() => import('./pages/CreatorOnboarding'));
const CreatorMediaLibrary      = lazy(() => import('./pages/CreatorMediaLibrary'));
const CreatorEditContent       = lazy(() => import('./pages/CreatorEditContent'));
const NotificationsPage        = lazy(() => import('./pages/NotificationsPage'));
const StaticPage               = lazy(() => import('./pages/StaticPage'));
const SetPasswordPage          = lazy(() => import('./pages/SetPasswordPage'));
const ResetPasswordPage        = lazy(() => import('./pages/ResetPasswordPage'));
const NotFoundPage             = lazy(() => import('./pages/NotFoundPage'));
const PaymentResultPage        = lazy(() => import('./pages/PaymentResultPage'));
const MagicLoginPage           = lazy(() => import('./pages/MagicLoginPage'));
const PaymentSuccessPage       = lazy(() => import('./pages/PaymentSuccessPage'));
const AgeVerificationReturnPage = lazy(() => import('./pages/AgeVerificationReturnPage'));
const PulsePreview              = lazy(() => import('./pages/PulsePreview'));
const LegacyWorksPublishing     = lazy(() => import('./pages/LegacyWorksPublishing'));
const VaultPage                 = lazy(() => import('./pages/VaultPage'));
const LiveRoomsPage             = lazy(() => import('./pages/LiveRoomsPage'));
const LiveRoomPage              = lazy(() => import('./pages/LiveRoomPage'));
const CreatorLiveStudio         = lazy(() => import('./pages/CreatorLiveStudio'));
const AdminLivePage             = lazy(() => import('./pages/AdminLivePage'));
const LiveSwipeFeed             = lazy(() => import('./pages/LiveSwipeFeed'));
const ClawPromotionPage         = lazy(() => import('./pages/ClawPromotionPage'));
const VirtualAngelsStudio       = lazy(() => import('./pages/VirtualAngelsStudio'));
const AIPersonaRoom             = lazy(() => import('./pages/AIPersonaRoom'));

// Requires: authenticated. If pending/rejected/suspended/banned → redirect to appropriate page.
// If requireApproved: must have status=approved.
// If requireCreator: must be approved + creator role.
// If requireAdmin: must be admin role.
function PreserveQueryRedirect({ to }: { to: string }) {
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  return <Navigate to={`${to}${qs ? '?' + qs : ''}`} replace />;
}

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
  const { isAuthenticated, isCreator, isAdmin, userStatus, refreshUser } = useAuth();
  const location = useLocation();
  // For creator-gated routes: try refreshing stale session once before blocking.
  // This lets newly-approved creators reach the studio without re-login.
  const [creatorCheckDone, setCreatorCheckDone] = useState(
    !requireCreator || isCreator || isAdmin
  );

  useEffect(() => {
    if (requireCreator && !isCreator && !isAdmin) {
      refreshUser().finally(() => setCreatorCheckDone(true));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  // Admin bypasses all status gates
  if (isAdmin) {
    return <>{children}</>;
  }

  // Waiting for creator session refresh before making the gate decision
  if (requireCreator && !creatorCheckDone) {
    return <SplashScreen />;
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
    <Suspense fallback={<SplashScreen />}>
    <Routes>
      <Route path="/" element={<AppShell />}>
        {/* Public */}
        <Route index element={<LandingPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="creator/:username" element={<CreatorProfilePage />} />
        <Route path="content/:id" element={<LockedContentPage />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="magic-login" element={<MagicLoginPage />} />
        <Route path="signup" element={<AuthPage mode="signup" />} />
        <Route path="request-access" element={<AuthPage mode="signup" />} />
        <Route path="set-password" element={<SetPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="payment/success" element={<PaymentSuccessPage />} />
        <Route path="verify-age/return" element={<AgeVerificationReturnPage />} />
        <Route path="privacy" element={<StaticPage page="privacy" />} />
        <Route path="terms" element={<StaticPage page="terms" />} />
        <Route path="compliance" element={<StaticPage page="compliance" />} />
        <Route path="dmca" element={<StaticPage page="dmca" />} />
        <Route path="age-verification" element={<StaticPage page="age-verification" />} />
        <Route path="contact" element={<StaticPage page="contact" />} />
        <Route path="report" element={<StaticPage page="report" />} />
        <Route path="help" element={<StaticPage page="help" />} />
        <Route path="preview/pulse" element={<PulsePreview />} />

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
        <Route path="notifications" element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        } />
        <Route path="vault" element={
          <ProtectedRoute>
            <VaultPage />
          </ProtectedRoute>
        } />
        <Route path="live" element={
          <ProtectedRoute>
            <LiveRoomsPage />
          </ProtectedRoute>
        } />
        <Route path="live/swipe" element={
          <ProtectedRoute>
            <LiveSwipeFeed />
          </ProtectedRoute>
        } />
        <Route path="live/:id" element={
          <ProtectedRoute>
            <LiveRoomPage />
          </ProtectedRoute>
        } />
        {/* Spec route alias: /live-room/:roomId → same Live Room page */}
        <Route path="live-room/:roomId" element={
          <ProtectedRoute>
            <LiveRoomPage />
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

        {/* Legacy redirect — Stripe used to return to /dashboard/studio */}
        <Route path="dashboard/studio" element={<PreserveQueryRedirect to="/studio" />} />

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
        <Route path="studio" element={
          <ProtectedRoute requireCreator>
            <CreatorDashboard />
          </ProtectedRoute>
        } />
        <Route path="studio/live" element={
          <ProtectedRoute requireCreator>
            <CreatorLiveStudio />
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
        <Route path="creator/media" element={
          <ProtectedRoute requireCreator>
            <CreatorMediaLibrary />
          </ProtectedRoute>
        } />
        <Route path="creator/content/:id/edit" element={
          <ProtectedRoute requireCreator>
            <CreatorEditContent />
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
        <Route path="admin/verifications" element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard initialTab="verifications" />
          </ProtectedRoute>
        } />
        <Route path="admin/pulse" element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard initialTab="pulse" />
          </ProtectedRoute>
        } />
        <Route path="admin/reviews" element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard initialTab="reviews" />
          </ProtectedRoute>
        } />
        <Route path="admin/control-center" element={
          <ProtectedRoute requireAdmin>
            <AdminControlCenter />
          </ProtectedRoute>
        } />
        <Route path="admin/live" element={
          <ProtectedRoute requireAdmin>
            <AdminLivePage />
          </ProtectedRoute>
        } />
        <Route path="admin/bug-control" element={
          <ProtectedRoute requireAdmin>
            <BugControlPage />
          </ProtectedRoute>
        } />
        <Route path="admin/legacy-works" element={
          <ProtectedRoute requireAdmin>
            <LegacyWorksPublishing />
          </ProtectedRoute>
        } />
        <Route path="admin/promotion" element={
          <ProtectedRoute requireAdmin>
            <ClawPromotionPage />
          </ProtectedRoute>
        } />

        {/* Virtual Angels Studio — approved members */}
        <Route path="angels" element={
          <ProtectedRoute>
            <VirtualAngelsStudio />
          </ProtectedRoute>
        } />
        <Route path="angels/:id" element={
          <ProtectedRoute>
            <AIPersonaRoom />
          </ProtectedRoute>
        } />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </Suspense>
  );
}

// Shows splash while auth is restoring from storage; min 2.2s so animation completes
function AppWithSplash() {
  const { isAuthLoading } = useAuth();
  const [minReady, setMinReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinReady(true), 2200);
    return () => clearTimeout(t);
  }, []);

  if (isAuthLoading || !minReady) return <SplashScreen />;
  return <AppRoutes />;
}

export default function App() {
  return (
    <BrowserRouter>
      <FeatureFlagsProvider>
        <AuthProvider>
          <SavedProvider>
            <ToastProvider>
              <ErrorBoundary>
                <LanguageProvider>
                  <AppWithSplash />
                </LanguageProvider>
              </ErrorBoundary>
            </ToastProvider>
          </SavedProvider>
        </AuthProvider>
      </FeatureFlagsProvider>
    </BrowserRouter>
  );
}
