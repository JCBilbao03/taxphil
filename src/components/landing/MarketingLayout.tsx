import { Outlet } from 'react-router-dom'

import { LandingFooter, LandingNavbar } from '@/components/landing/LandingNavbar'

export function MarketingLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <LandingNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <LandingFooter />
    </div>
  )
}
