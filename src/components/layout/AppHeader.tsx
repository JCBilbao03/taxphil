import { Bell, LogOut, Menu, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuthStore, useAuthUser } from '@/store/useAuthStore'
import { useTaxStore } from '@/store/useTaxStore'
import { formatCurrency } from '@/lib/utils'

interface AppHeaderProps {
  title: string
  description?: string
  onMenuClick?: () => void
}

export function AppHeader({ title, description, onMenuClick }: AppHeaderProps) {
  const navigate = useNavigate()
  const user = useAuthUser()
  const signOut = useAuthStore((state) => state.signOut)
  const netIncome = useTaxStore((state) => state.netIncome())

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-white px-4 sm:h-16 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 md:hidden"
            onClick={onMenuClick}
            aria-label="Open navigation menu"
          >
            <Menu className="size-5" />
          </Button>
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {title}
          </h1>
          {description ? (
            <p className="hidden truncate text-sm text-muted-foreground sm:block">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-4">
        <div className="hidden text-right lg:block">
          <p className="text-xs text-muted-foreground">Net income (YTD)</p>
          <p className="text-sm font-semibold text-foreground">
            {formatCurrency(netIncome)}
          </p>
        </div>

        <Button variant="ghost" size="icon-sm" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>

        <Button variant="outline" size="icon-sm" className="sm:hidden" aria-label="My account">
          <User className="size-4" />
        </Button>

        <Button variant="outline" size="sm" className="hidden gap-2 sm:inline-flex">
          <User className="size-4" />
          <span className="hidden max-w-32 truncate md:inline">
            {user?.displayName ?? user?.email ?? 'My Account'}
          </span>
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className="sm:hidden"
          onClick={handleSignOut}
          aria-label="Sign out"
        >
          <LogOut className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="hidden gap-2 sm:inline-flex"
          onClick={handleSignOut}
        >
          <LogOut className="size-4" />
          <span className="hidden md:inline">Sign out</span>
        </Button>
      </div>
    </header>
  )
}
