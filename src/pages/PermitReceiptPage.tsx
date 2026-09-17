import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ButtonLink } from '@/components/landing/ButtonLink'
import { PermitReceiptCard } from '@/components/permits/PermitReceiptCard'
import { refreshPermitPayment } from '@/lib/paymongo'
import { usePermitStore } from '@/store/usePermitStore'

export function PermitReceiptPage() {
  const { permitId } = useParams<{ permitId: string }>()
  return <PermitReceiptContent key={permitId} permitId={permitId} />
}

function PermitReceiptContent({ permitId }: { permitId: string | undefined }) {
  const [params] = useSearchParams()
  const { permits, payments, loading, error: syncError } = usePermitStore()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [statusNotice, setStatusNotice] = useState('')
  const permit = permits.find((item) => item.id === permitId)
  const payment = payments.find((item) => item.id === permit?.paymentId)
  async function refresh() {
    if (!permitId) return
    setRefreshing(true); setRefreshError(''); setStatusNotice('')
    try {
      const result = await refreshPermitPayment(permitId)
      setStatusNotice(result.status === 'paid' ? 'Payment confirmation received. The saved record is updating.' : result.status === 'expired' ? 'The payment provider reports that this checkout is expired.' : 'The provider has not reported a successful payment for this checkout.')
    } catch (error) { setRefreshError(error instanceof Error ? error.message : 'Payment status could not be checked.') } finally { setRefreshing(false) }
  }
  const returned = params.get('checkout')
  const notice = statusNotice || (returned === 'cancelled' ? 'You returned from checkout. The return link does not cancel or confirm payment; check the saved status before trying again.' : returned === 'returned' ? 'You returned from PayMongo. Payment is confirmed only after the provider status is recorded below.' : '')
  if (loading) return <div role="status" className="mx-auto max-w-3xl text-sm text-slate-500">Loading payment record…</div>
  if (syncError || !permit) return <div className="mx-auto max-w-3xl space-y-4"><p role={syncError ? 'alert' : undefined} className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">{syncError || 'This payment record is not available in your account. It may still be syncing.'}</p><ButtonLink to="/permits" variant="outline">Back to payment history</ButtonLink></div>
  return <div className="mx-auto max-w-3xl"><PermitReceiptCard permit={permit} payment={payment} refreshing={refreshing} onRefresh={() => void refresh()} refreshError={refreshError} checkoutNotice={notice} /></div>
}
