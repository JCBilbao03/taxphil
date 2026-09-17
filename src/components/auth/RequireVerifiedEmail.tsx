import { isAccountingDemo } from '@/lib/demo-access'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthInitialized, useAuthUser } from '@/store/useAuthStore'

export function RequireVerifiedEmail() {
  const user = useAuthUser()
  const { pathname } = useLocation()
  const initialized = useAuthInitialized()

  if (!initialized) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (user && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />
  }

  if (isAccountingDemo(user) && pathname !== '/accounting' && !pathname.startsWith('/accounting/')) {
    return <Navigate to="/accounting" replace />
  }

  return <Outlet />
}
