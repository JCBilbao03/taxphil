import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PermitList } from '@/components/permits/PermitList'
import { PermitPaymentForm } from '@/components/permits/PermitPaymentForm'
import { useAuthUser } from '@/store/useAuthStore'
import { usePermitStore } from '@/store/usePermitStore'

export function PermitsPage() {
  const [searchParams] = useSearchParams()
  const user = useAuthUser()
  const permits = usePermitStore((state) => state.permits)
  const loading = usePermitStore((state) => state.loading)
  const syncError = usePermitStore((state) => state.error)
  const [formError, setFormError] = useState<string | null>(null)
  const cancelNotice = searchParams.get('checkout') === 'cancelled'

  const error = formError ?? syncError

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {cancelNotice ? (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          You returned from checkout. Returning does not cancel or confirm a payment. Open your saved payment record to resume or check its status.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-deadline-urgent/20 bg-deadline-urgent-bg px-4 py-3 text-sm text-deadline-urgent">
          {error}
        </p>
      ) : null}

      {!loading && <PermitPaymentForm key={`${user?.uid}:${searchParams.get('retry') || 'new'}`} initial={permits.find(item => item.id === searchParams.get('retry') && ['failed', 'expired'].includes(item.status))} onError={setFormError} />}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading assistance payment history…</p>
      ) : (
        <PermitList permits={permits} />
      )}
    </div>
  )
}
