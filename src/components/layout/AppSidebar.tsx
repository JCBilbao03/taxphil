import { Link, NavLink } from 'react-router-dom'
import {
  Headphones,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  FileText,
  Settings,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { isSupportAdminEmail } from '@/lib/support-admin-access'
import { cn } from '@/lib/utils'
import { useAuthUser } from '@/store/useAuthStore'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/income-expenses', label: 'Income & Expenses', icon: Receipt },
  { to: '/tax-dues', label: 'Tax Dues', icon: FileText },
  { to: '/connect', label: 'Connect', icon: MessageSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

interface AppSidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAuthUser()
  const showSupportAdmin = isSupportAdminEmail(user?.email)

  return (
    <>
      <Link
        to="/"
        onClick={onNavigate}
        className="flex h-16 items-center gap-2.5 border-b border-border px-6"
      >
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
          TP
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-foreground">
            TaxPhil
          </p>
          <p className="text-xs text-muted-foreground">BIR Tax Filing</p>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        ))}

        {showSupportAdmin ? (
          <NavLink
            to="/admin/support"
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            <Headphones className="size-4 shrink-0" />
            Support Inbox
          </NavLink>
        ) : null}
      </nav>

      <div className="border-t border-border p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Tax year 2026 · Registered as Self-Employed
        </p>
      </div>
    </>
  )
}

export function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-white md:flex">
        <SidebarContent />
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onMobileClose}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,18rem)] flex-col border-r border-border bg-white shadow-xl transition-transform duration-300 ease-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="flex h-16 items-center justify-end border-b border-border px-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </Button>
        </div>
        <SidebarContent onNavigate={onMobileClose} />
      </aside>
    </>
  )
}
