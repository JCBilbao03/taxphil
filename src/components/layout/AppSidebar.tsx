import { Link, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  MessageSquare,
  Receipt,
  FileText,
  Settings,
} from 'lucide-react'

import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/income-expenses', label: 'Income & Expenses', icon: Receipt },
  { to: '/tax-dues', label: 'Tax Dues', icon: FileText },
  { to: '/connect', label: 'Connect', icon: MessageSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

export function AppSidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-white">
      <Link to="/" className="flex h-16 items-center gap-2.5 border-b border-border px-6">
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

      <nav className="flex flex-1 flex-col gap-1 p-4">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
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
      </nav>

      <div className="border-t border-border p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Tax year 2026 · Registered as Self-Employed
        </p>
      </div>
    </aside>
  )
}
