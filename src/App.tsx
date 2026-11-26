import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ReportDraftProvider } from './context/ReportDraftContext';

import { LandingPage } from './pages/LandingPage';
import { ExplorePage } from './pages/ExplorePage';
import { ContractorBiddingPage } from './pages/ContractorBiddingPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { SafetyCentrePage } from './pages/SafetyCentrePage';
import { LoginPage, ResetPasswordPage, SignupPage, VerifyIdentityPage, VerifyPhonePage } from './pages/AuthPages';
import { CitizenHomePage } from './pages/CitizenHomePage';
import { OnboardingProfilePage } from './pages/OnboardingProfilePage';
import { CreateReportPage, PreviewReportPage, ReportSubmittedPage } from './pages/CreateReportPages';
import { MyReportsPage } from './pages/MyReportsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminLoginPage } from './pages/Admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/Admin/AdminDashboardPage';
import { AdminReportReviewPage } from './pages/Admin/AdminReportReviewPage';
import { AdminContentReportsPage } from './pages/Admin/AdminContentReportsPage';
import { PublicProjectsPage } from './pages/Gov/PublicProjectsPage';
import { PublicProjectDetailPage } from './pages/Gov/PublicProjectDetailPage';
import { ContractorRegistryPage } from './pages/Gov/ContractorRegistryPage';
import { GovDashboardPage } from './pages/Gov/GovDashboardPage';
import { GovProjectWorkspacePage } from './pages/Gov/GovProjectWorkspacePage';
import { FinanceDashboardPage } from './pages/Finance/FinanceDashboardPage';
import { PaymentSettingsPage } from './pages/Finance/PaymentSettingsPage';

function ProtectedCitizenRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F2] text-sm text-[#4B5563]">
        Loading जनConnect session...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function ProtectedModeratorRoute({ children }: { children: React.ReactNode }) {
  const { user, isModerator, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F2] text-sm text-[#4B5563]">
        Verifying moderator privileges...
      </div>
    );
  }
  if (!user || !isModerator) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

function ProtectedGovRoute({ children }: { children: React.ReactNode }) {
  const { user, isGovernmentAuthority, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F2] text-sm text-[#4B5563]">
        Verifying government authority privileges...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!isGovernmentAuthority) {
    return <Navigate to="/projects" replace />;
  }
  return <>{children}</>;
}

function ProtectedFinanceRoute({ children }: { children: React.ReactNode }) {
  const { user, isFinancialAdmin, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F2] text-sm text-[#4B5563]">
        Verifying financial administrator privileges...
      </div>
    );
  }
  if (!user || !isFinancialAdmin) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  return (
    <BrowserRouter>
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <AuthProvider>
        <ToastProvider>
          <ReportDraftProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/projects" element={<PublicProjectsPage />} />
              <Route path="/projects/:id" element={<PublicProjectDetailPage />} />
              <Route path="/contractor-registry" element={<ContractorRegistryPage />} />
              <Route path="/contractors" element={<ContractorBiddingPage />} />
              <Route path="/reports/:id" element={<ReportDetailPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-phone" element={<VerifyPhonePage />} />
              <Route path="/verify-identity" element={<VerifyIdentityPage />} />
              <Route path="/safety" element={<SafetyCentrePage />} />
              <Route path="/profile/:username" element={<PublicProfilePage />} />

              {/* Citizen Protected Routes */}
              <Route
                path="/home"
                element={
                  <ProtectedCitizenRoute>
                    <CitizenHomePage />
                  </ProtectedCitizenRoute>
                }
              />
              <Route
                path="/onboarding/profile"
                element={
                  <ProtectedCitizenRoute>
                    <OnboardingProfilePage />
                  </ProtectedCitizenRoute>
                }
              />
              <Route
                path="/reports/create"
                element={
                  <ProtectedCitizenRoute>
                    <CreateReportPage />
                  </ProtectedCitizenRoute>
                }
              />
              <Route
                path="/reports/preview"
                element={
                  <ProtectedCitizenRoute>
                    <PreviewReportPage />
                  </ProtectedCitizenRoute>
                }
              />
              <Route
                path="/reports/submitted/:id"
                element={
                  <ProtectedCitizenRoute>
                    <ReportSubmittedPage />
                  </ProtectedCitizenRoute>
                }
              />
              <Route
                path="/my-reports"
                element={
                  <ProtectedCitizenRoute>
                    <MyReportsPage />
                  </ProtectedCitizenRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedCitizenRoute>
                    <NotificationsPage />
                  </ProtectedCitizenRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedCitizenRoute>
                    <SettingsPage />
                  </ProtectedCitizenRoute>
                }
              />

              {/* Moderator Routes */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route
                path="/admin"
                element={
                  <ProtectedModeratorRoute>
                    <AdminDashboardPage />
                  </ProtectedModeratorRoute>
                }
              />
              <Route
                path="/admin/reports/:id"
                element={
                  <ProtectedModeratorRoute>
                    <AdminReportReviewPage />
                  </ProtectedModeratorRoute>
                }
              />
              <Route
                path="/admin/content-reports"
                element={
                  <ProtectedModeratorRoute>
                    <AdminContentReportsPage />
                  </ProtectedModeratorRoute>
                }
              />

              {/* Government Authority Routes */}
              <Route
                path="/gov"
                element={
                  <ProtectedGovRoute>
                    <GovDashboardPage />
                  </ProtectedGovRoute>
                }
              />
              <Route
                path="/gov/projects/:id"
                element={
                  <ProtectedGovRoute>
                    <GovProjectWorkspacePage />
                  </ProtectedGovRoute>
                }
              />

              {/* Financial Admin & 1% Facilitation Fee Routes */}
              <Route
                path="/finance"
                element={
                  <ProtectedFinanceRoute>
                    <FinanceDashboardPage />
                  </ProtectedFinanceRoute>
                }
              />
              <Route
                path="/finance/payment-settings"
                element={
                  <ProtectedFinanceRoute>
                    <PaymentSettingsPage />
                  </ProtectedFinanceRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ReportDraftProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
