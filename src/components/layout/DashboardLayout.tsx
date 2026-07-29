import { Outlet } from 'react-router-dom'

import { SupportWidget } from '@/components/connect/SupportWidget'
import { AppHeader } from '@/components/layout/AppHeader'
import { AppSidebar } from '@/components/layout/AppSidebar'

interface DashboardLayoutProps {
  title: string
  description?: string
}

export function DashboardLayout({ title, description }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-svh bg-muted/30">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader title={title} description={description} />
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
      <SupportWidget />
    </div>
  )
}
