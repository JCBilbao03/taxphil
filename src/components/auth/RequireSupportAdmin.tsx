import { Navigate, Outlet } from 'react-router-dom'

import { isSupportAdminEmail } from '@/lib/support-admin-access'
import { useAuthInitialized, useAuthUser } from '@/store/useAuthStore'

export function RequireSupportAdmin() {
  const user = useAuthUser()
  const initialized = useAuthInitialized()

  if (!initialized) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user || !isSupportAdminEmail(user.email)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
