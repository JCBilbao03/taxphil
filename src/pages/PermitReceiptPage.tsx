import { useParams } from 'react-router-dom'

import { ButtonLink } from '@/components/landing/ButtonLink'
import { PermitReceiptCard } from '@/components/permits/PermitReceiptCard'
import { usePermitStore } from '@/store/usePermitStore'

export function PermitReceiptPage() {
  const { permitId } = useParams<{ permitId: string }>()
  const loading = usePermitStore((state) => state.loading)
  const syncError = usePermitStore((state) => state.error)
  const getPermitById = usePermitStore((state) => state.getPermitById)
  const getPaymentByPermitId = usePermitStore((state) => state.getPaymentByPermitId)

  const permit = permitId ? getPermitById(permitId) : undefined
  const payment = permitId ? getPaymentByPermitId(permitId) : undefined
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-muted-foreground">Loading receipt…</p>
      </div>
    )
  }

  if (syncError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="rounded-md border border-deadline-urgent/20 bg-deadline-urgent-bg px-4 py-3 text-sm text-deadline-urgent">
          {syncError}
        </p>
        <ButtonLink to="/permits" variant="outline" className="min-h-11">
          Back to permits
        </ButtonLink>
      </div>
    )
  }

  if (!permit) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Permit not found. It may still be syncing — refresh in a moment.
        </p>
        <ButtonLink to="/permits" variant="outline" className="min-h-11">
          Back to permits
        </ButtonLink>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PermitReceiptCard
        permit={permit}
        payment={payment}
        waitingForConfirmation={permit.status === 'pending'}
      />
    </div>
  )
}
