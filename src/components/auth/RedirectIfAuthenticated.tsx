import { signedInDestination } from '@/lib/demo-access'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuthInitialized, useAuthUser } from '@/store/useAuthStore'

interface RedirectIfAuthenticatedProps {
  children: ReactNode
}

export function RedirectIfAuthenticated({ children }: RedirectIfAuthenticatedProps) {
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

  if (user) {
    const from =
      typeof location.state === 'object' &&
      location.state !== null &&
      'from' in location.state &&
      typeof location.state.from === 'string'
        ? location.state.from
        : '/dashboard'

    const destination = user.emailVerified ? signedInDestination(user, from) : '/verify-email'

    return <Navigate to={destination} replace />
  }

  return children
}
