import { CheckCircle2, Clock, ExternalLink, Loader2, Printer, RefreshCw } from 'lucide-react'
import { ButtonLink } from '@/components/landing/ButtonLink'
import { Button, buttonVariants } from '@/components/ui/button'
import { paymentChannelLabel, permitStatusClass, permitStatusLabel } from '@/components/permits/permit-status-utils'
import { formatCurrency, formatDate } from '@/lib/utils'
import { paymongoCheckoutUrl } from '@/lib/permit-payments'
import type { Permit, PermitPayment } from '@/store/usePermitStore'

export function PermitReceiptCard({ permit, payment, refreshing = false, onRefresh, refreshError, checkoutNotice }: {
  permit: Permit; payment: PermitPayment | undefined; refreshing?: boolean; onRefresh?: () => void; refreshError?: string; checkoutNotice?: string
}) {
  const isPaid = permit.status === 'paid' && payment?.status === 'paid'
  let checkoutUrl: string | null = null
  try { if (!isPaid && permit.status === 'pending' && payment?.checkoutUrl) checkoutUrl = paymongoCheckoutUrl(payment.checkoutUrl) } catch { /* No invalid provider URL is rendered. */ }
  const mode = payment?.livemode ?? permit.livemode
  return <section className="rounded-xl border border-slate-200 bg-white p-5 text-slate-800 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">TaxPhil assistance payment record</p><h2 className="mt-2 text-xl font-semibold text-slate-900">{permit.businessName}</h2><p className="mt-2 text-sm text-slate-500">{permit.lgu} · {permit.year} · {permit.permitType === 'new' ? 'New permit assistance' : 'Renewal assistance'}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-medium ${permitStatusClass(permit.status)}`}>{mode === false ? 'Test · ' : ''}{isPaid ? 'Payment confirmed' : permit.status === 'paid' ? 'Checking payment record' : permitStatusLabel(permit.status)}</span></div>
    <div className="mt-5 space-y-4">
      {checkoutNotice ? <p className="rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-900">{checkoutNotice}</p> : null}
      <div className={`flex items-start gap-3 rounded-lg p-4 text-sm leading-6 ${isPaid ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{isPaid ? <CheckCircle2 className="mt-1 size-4 shrink-0" /> : <Clock className="mt-1 size-4 shrink-0" />}<p>{isPaid ? mode === false ? 'The provider confirmed this test payment. It does not represent a transfer of real money.' : 'The provider confirmation has been recorded. This record relates to the TaxPhil assistance payment.' : permit.status === 'expired' ? 'This checkout is expired. Check your payment records before creating a replacement request.' : permit.status === 'failed' ? 'This checkout is marked failed. Check the provider status before retrying.' : 'No payment confirmation has been recorded yet. Use Check payment status to refresh, or resume your saved checkout if you have not paid.'}</p></div>
      {refreshError ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{refreshError}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">{isPaid ? mode === false ? 'Test amount' : 'Recorded amount paid' : 'Requested assistance fee'}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(permit.amount)}</p></div><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-medium text-slate-500">Payment reference</p><p className="mt-2 break-all font-mono text-sm">{payment?.referenceNumber || 'Not available yet'}</p></div></div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">{[
        ['TaxPhil service reference', permit.assistanceReference || payment?.assistanceReference || 'Not recorded on this legacy request'],
        ['Payment method', payment ? paymentChannelLabel(payment.channel) : 'Not confirmed'],
        ['Payment environment', mode === true ? 'Live' : mode === false ? 'Test' : 'Not recorded'],
        [isPaid && payment?.paidAt ? 'Confirmation date' : 'Request created', formatDate(isPaid && payment?.paidAt ? payment.paidAt : permit.createdAt)],
      ].map(([title, value]) => <div key={title}><dt className="text-slate-500">{title}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl>
      <p className="rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-500">TaxPhil is the merchant receiving this assistance payment. This is a payment record, not an official LGU receipt or proof that a permit was issued. Government fees and filing requirements are handled separately with the city or municipality.</p>
    </div>
    <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-5 print:hidden">
      {onRefresh && !isPaid ? <Button disabled={refreshing} onClick={onRefresh}>{refreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Check payment status</Button> : null}
      {checkoutUrl ? <a href={checkoutUrl} className={buttonVariants({ variant: 'outline' })}><ExternalLink className="size-4" />Resume saved checkout</a> : null}
      {['expired', 'failed'].includes(permit.status) ? <ButtonLink to={`/permits?retry=${permit.id}`} variant="outline">Review a replacement request</ButtonLink> : null}
      <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" />Print record</Button>
      <ButtonLink to="/permits" variant="outline">Payment history</ButtonLink><ButtonLink to="/connect" variant="outline">Contact support</ButtonLink>
    </div>
  </section>
}
