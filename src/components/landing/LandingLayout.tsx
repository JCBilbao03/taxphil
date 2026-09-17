import { LandingFooter, LandingNavbar } from '@/components/landing/LandingNavbar'
import { LandingPage } from '@/pages/LandingPage'

export function LandingLayout() {
  return <div className="flex min-h-svh flex-col"><LandingNavbar /><main className="flex-1"><LandingPage /></main><LandingFooter /></div>
}
