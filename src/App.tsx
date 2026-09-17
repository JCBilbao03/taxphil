import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { HashNavigationHandler } from '@/components/routing/HashNavigationHandler'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { RedirectIfAuthenticated } from '@/components/auth/RedirectIfAuthenticated'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { RequireVerifiedEmail } from '@/components/auth/RequireVerifiedEmail'
import { RequireSupportAdmin } from '@/components/auth/RequireSupportAdmin'
import { RedirectIfVerified } from '@/components/auth/RedirectIfVerified'
import { LandingLayout } from '@/components/landing/LandingLayout'
import { MarketingLayout } from '@/components/landing/MarketingLayout'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ConnectPage } from '@/pages/ConnectPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { IncomeExpensesPage } from '@/pages/IncomeExpensesPage'
import { LoginPage } from '@/pages/LoginPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResendVerificationPage } from '@/pages/ResendVerificationPage'
import { MediaBlogPage } from '@/pages/MediaBlogPage'
import { AboutUsPage } from '@/pages/AboutUsPage'
import { MediaVideosPage } from '@/pages/MediaVideosPage'
import { SignupPage } from '@/pages/SignupPage'
import { VerifyEmailPage } from '@/pages/VerifyEmailPage'
import { TaxDuesPage } from '@/pages/TaxDuesPage'
import { PermitsPage } from '@/pages/PermitsPage'
import { PermitReceiptPage } from '@/pages/PermitReceiptPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SupportAdminPage } from '@/pages/SupportAdminPage'
import { AccountingPage } from '@/pages/AccountingPage'
import { AccountingLayout } from '@/components/accounting/AccountingShell'

export function App() {
  return (
    <BrowserRouter>
      <HashNavigationHandler />
      <Routes>
        <Route path="/" element={<LandingLayout />} />

        <Route element={<MarketingLayout />}>
          <Route path="about" element={<AboutUsPage />} />
          <Route path="media/videos" element={<MediaVideosPage />} />
          <Route path="media/blog" element={<MediaBlogPage />} />
        </Route>

        <Route
          element={
            <RedirectIfAuthenticated>
              <AuthLayout />
            </RedirectIfAuthenticated>
          }
        >
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="resend-verification" element={<ResendVerificationPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<RedirectIfVerified />}>
            <Route element={<AuthLayout />}>
              <Route path="verify-email" element={<VerifyEmailPage />} />
            </Route>
          </Route>

          <Route element={<RequireVerifiedEmail />}>
            <Route element={<AccountingLayout />}>
              <Route path="accounting" element={<AccountingPage />} />
              <Route path="accounting/:module" element={<AccountingPage />} />
            </Route>
            <Route
              element={
                <DashboardLayout
                  title="Dashboard"
                  description="Overview of your tax obligations and financial summary"
                />
              }
            >
              <Route path="dashboard" element={<DashboardPage />} />
            </Route>

            <Route
              element={
                <DashboardLayout
                  title="Income & Expenses"
                  description="Track receipts, invoices, and deductible expenses"
                />
              }
            >
              <Route path="income-expenses" element={<IncomeExpensesPage />} />
            </Route>

            <Route
              element={
                <DashboardLayout
                  title="Tax Dues"
                  description="Upcoming BIR filing deadlines and amounts due"
                />
              }
            >
              <Route path="tax-dues" element={<TaxDuesPage />} />
            </Route>

            <Route
              element={
                <DashboardLayout
                  title="Business Permits"
                  description="Pay mayor's permit fees via PayMongo"
                />
              }
            >
              <Route path="permits" element={<PermitsPage />} />
              <Route
                path="permits/:permitId/receipt"
                element={<PermitReceiptPage />}
              />
            </Route>

            <Route
              element={
                <DashboardLayout
                  title="Connect"
                  description="Chat, video call, or join a conference with tax experts"
                />
              }
            >
              <Route path="connect" element={<ConnectPage />} />
            </Route>

            <Route
              element={
                <DashboardLayout
                  title="Settings"
                  description="Manage your taxpayer profile and registration"
                />
              }
            >
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route element={<RequireSupportAdmin />}>
              <Route
                element={
                  <DashboardLayout
                    title="Support Inbox"
                    description="Review and reply to taxpayer support messages"
                  />
                }
              >
                <Route path="admin/support" element={<SupportAdminPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
