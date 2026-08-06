import { useEffect, useState } from 'react'
import { Loader2, Mail, User } from 'lucide-react'

import { fetchTaxpayerProfile, type TaxpayerProfile } from '@/lib/support-admin'
import { cn } from '@/lib/utils'

interface SupportUserContextProps {
  userId: string
  displayName: string
  userEmail: string
  className?: string
}

export function SupportUserContext({
  userId,
  displayName,
  userEmail,
  className,
}: SupportUserContextProps) {
  const [profile, setProfile] = useState<TaxpayerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void fetchTaxpayerProfile(userId)
      .then((result) => {
        if (!cancelled) setProfile(result)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <div
      className={cn(
        'border-b border-border bg-muted/10 px-4 py-3',
        className,
      )}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{displayName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="size-3 shrink-0" />
            <span className="truncate">{userEmail}</span>
          </p>
        </div>

        {loading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : profile ? (
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-muted-foreground ring-1 ring-border">
              <User className="size-3" />
              Member since{' '}
              {profile.memberSince
                ? new Intl.DateTimeFormat('en-PH', {
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(profile.memberSince))
                : '—'}
            </span>
          </div>
        ) : null}
      </div>
      <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground/70">
        UID: {userId}
      </p>
    </div>
  )
}
