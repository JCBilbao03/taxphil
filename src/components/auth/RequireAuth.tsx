import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthInitialized, useAuthUser } from '@/store/useAuthStore'

export function RequireAuth() {
  const user = useAuthUser()
  const initialized = useAuthInitialized()
  const location = useLocation()

  if (!initialized) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
