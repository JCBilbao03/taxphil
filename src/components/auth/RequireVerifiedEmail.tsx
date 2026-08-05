import { Navigate, Outlet } from 'react-router-dom'

import { useAuthInitialized, useAuthUser } from '@/store/useAuthStore'

export function RequireVerifiedEmail() {
  const user = useAuthUser()
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

  return <Outlet />
}
