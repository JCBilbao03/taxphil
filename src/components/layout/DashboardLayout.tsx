import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { SupportWidget } from '@/components/connect/SupportWidget'
import { AppHeader } from '@/components/layout/AppHeader'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { useChatSync } from '@/hooks/useChatSync'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePermitSync } from '@/hooks/usePermitSync'
import { useTaxDataSync } from '@/hooks/useTaxDataSync'

export function DashboardLayout({ title, description, showTaxSummary = true }: { title: string; description?: string; showTaxSummary?: boolean }) {
  useChatSync(); useTaxDataSync(); usePermitSync(); usePushNotifications()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  return (
    <div className="flex min-h-svh flex-col bg-[#f3f6f9]">
      <a href="#workspace-content" className="sr-only z-50 bg-white p-3 text-blue-700 focus:not-sr-only">Skip to workspace content</a>
      <AppSidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <AppHeader title={title} showTaxSummary={showTaxSummary} description={description} onMenuClick={() => setMobileNavOpen(true)} />
      <main id="workspace-content" className="mx-auto w-full max-w-[1600px] min-w-0 flex-1 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 lg:p-8"><Outlet /></main>
      <footer className="flex flex-wrap justify-between gap-3 border-t border-slate-200 px-6 py-4 text-xs text-slate-500"><span>TaxPhil · Philippine business workspace</span><Link to="/help" className="font-medium text-blue-700">Help &amp; account information</Link></footer>
      <SupportWidget />
    </div>
  )
}
