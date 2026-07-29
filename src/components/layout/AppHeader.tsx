import { Bell, LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuthStore, useAuthUser } from '@/store/useAuthStore'
import { useTaxStore } from '@/store/useTaxStore'
import { formatCurrency } from '@/lib/utils'

interface AppHeaderProps {
  title: string
  description?: string
}

export function AppHeader({ title, description }: AppHeaderProps) {
  const navigate = useNavigate()
  const user = useAuthUser()
  const signOut = useAuthStore((state) => state.signOut)
  const netIncome = useTaxStore((state) => state.netIncome())

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-8">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden text-right sm:block">
          <p className="text-xs text-muted-foreground">Net income (YTD)</p>
          <p className="text-sm font-semibold text-foreground">
            {formatCurrency(netIncome)}
          </p>
        </div>

        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>

        <Button variant="outline" size="sm" className="gap-2">
          <User className="size-4" />
          <span className="hidden max-w-32 truncate sm:inline">
            {user?.displayName ?? user?.email ?? 'My Account'}
          </span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={handleSignOut}
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  )
}
