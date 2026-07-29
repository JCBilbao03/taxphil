import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { AuthLayout } from '@/components/auth/AuthLayout'
import { RedirectIfAuthenticated } from '@/components/auth/RedirectIfAuthenticated'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { LandingLayout } from '@/components/landing/LandingLayout'
import { MarketingLayout } from '@/components/landing/MarketingLayout'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ConnectPage } from '@/pages/ConnectPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { IncomeExpensesPage } from '@/pages/IncomeExpensesPage'
import { LoginPage } from '@/pages/LoginPage'
import { MediaBlogPage } from '@/pages/MediaBlogPage'
import { MediaVideosPage } from '@/pages/MediaVideosPage'
import { SignupPage } from '@/pages/SignupPage'
import { TaxDuesPage } from '@/pages/TaxDuesPage'
import { SettingsPage } from '@/pages/SettingsPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingLayout />} />

        <Route element={<MarketingLayout />}>
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
        </Route>

        <Route element={<RequireAuth />}>
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
