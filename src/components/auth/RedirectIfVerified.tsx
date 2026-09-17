import { signedInDestination } from '@/lib/demo-access'
import { Navigate, Outlet } from 'react-router-dom'

import { useAuthInitialized, useAuthUser } from '@/store/useAuthStore'

export function RedirectIfVerified() {
  const user = useAuthUser()
  const initialized = useAuthInitialized()

  if (!initialized) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (user?.emailVerified) {
    return <Navigate to={signedInDestination(user)} replace />
  }

  return <Outlet />
}
