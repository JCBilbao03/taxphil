import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { SupportWidget } from '@/components/connect/SupportWidget'
import { AppHeader } from '@/components/layout/AppHeader'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { useChatSync } from '@/hooks/useChatSync'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePermitSync } from '@/hooks/usePermitSync'
import { useTaxDataSync } from '@/hooks/useTaxDataSync'

interface DashboardLayoutProps {
  title: string
  description?: string
  showTaxSummary?: boolean
}

export function DashboardLayout({ title, description, showTaxSummary = true }: DashboardLayoutProps) {
  useChatSync()
  useTaxDataSync()
  usePermitSync()
  usePushNotifications()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-svh bg-muted/30">
      <AppSidebar
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          title={title}
          showTaxSummary={showTaxSummary}
          description={description}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <SupportWidget />
    </div>
  )
}
