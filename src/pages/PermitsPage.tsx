import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PermitList } from '@/components/permits/PermitList'
import { PermitPaymentForm } from '@/components/permits/PermitPaymentForm'
import { usePermitStore } from '@/store/usePermitStore'

export function PermitsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const permits = usePermitStore((state) => state.permits)
  const loading = usePermitStore((state) => state.loading)
  const syncError = usePermitStore((state) => state.error)
  const [formError, setFormError] = useState<string | null>(null)
  const [cancelNotice, setCancelNotice] = useState(false)

  useEffect(() => {
    if (searchParams.get('checkout') === 'cancelled') {
      setCancelNotice(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const error = formError ?? syncError

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {cancelNotice ? (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Checkout was cancelled. You can start a new payment below.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-deadline-urgent/20 bg-deadline-urgent-bg px-4 py-3 text-sm text-deadline-urgent">
          {error}
        </p>
      ) : null}

      <PermitPaymentForm onError={setFormError} />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading permit history…</p>
      ) : (
        <PermitList permits={permits} />
      )}
    </div>
  )
}
