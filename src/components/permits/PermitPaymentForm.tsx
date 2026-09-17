import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { MAJOR_LGUS } from '@/components/permits/lgu-options'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createPermitCheckout } from '@/lib/paymongo'
import { validateAssistanceCheckout } from '@/lib/permit-payments'
import { getUserProfile } from '@/lib/firestore/user-profile'
import { useAuthUser } from '@/store/useAuthStore'
import type { Permit, PermitType } from '@/store/usePermitStore'

const control = 'min-h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm'
const label = 'grid gap-2 text-sm font-medium text-slate-700'
export function PermitPaymentForm({ onError, initial }: { onError: (message: string | null) => void; initial?: Permit }) {
  const user = useAuthUser()
  const currentYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date()))
  const [businessName, setBusinessName] = useState(initial?.businessName || '')
  const [lgu, setLgu] = useState(initial?.lgu || '')
  const [permitType, setPermitType] = useState<PermitType>(initial?.permitType || 'renewal')
  const [year, setYear] = useState(String(initial?.year || currentYear))
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [assistanceReference, setAssistanceReference] = useState(initial?.assistanceReference || '')
  const [acknowledgedMerchant, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const attempt = useRef<{ payload: string; id: string } | null>(null)
  useEffect(() => {
    if (!user?.uid || initial) return
    let cancelled = false
    void getUserProfile(user.uid).then((profile) => {
      if (!cancelled && profile?.businessName) setBusinessName((current) => current || profile.businessName || '')
    }).catch(() => { /* The business name can be entered manually when profile loading fails. */ })
    return () => { cancelled = true }
  }, [user?.uid, initial])
  async function submit(event: FormEvent) {
    event.preventDefault(); onError(null); setSubmitting(true)
    try {
      const payload = JSON.stringify({ businessName, lgu, permitType, year, amount, assistanceReference })
      if (attempt.current?.payload !== payload) attempt.current = { payload, id: crypto.randomUUID() }
      const input = validateAssistanceCheckout({ businessName, lgu, permitType, year: Number(year), amount: Number(amount), assistanceReference, acknowledgedMerchant, requestId: attempt.current!.id }, currentYear)
      const result = await createPermitCheckout(input)
      window.location.assign(result.checkoutUrl)
    } catch (error) { onError(error instanceof Error ? error.message : 'Could not start checkout. Check your saved payment status before trying again.'); setSubmitting(false) }
  }
  return <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
    <h2 className="text-xl font-semibold text-slate-900">Pay for TaxPhil permit assistance</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Use the fee and reference agreed with TaxPhil Support. PayMongo processes the payment to the TaxPhil merchant account. Government fees and permit issuance are handled separately with your LGU.</p>
    <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-5"><fieldset disabled={submitting} className="grid gap-4 sm:grid-cols-2">
      <label className={label}>Business name<Input required maxLength={200} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Registered business name" /></label>
      <label className={label}>City / municipality<Input required list="lgu-suggestions" maxLength={120} value={lgu} onChange={(e) => setLgu(e.target.value)} placeholder="e.g. Quezon City" /><datalist id="lgu-suggestions">{MAJOR_LGUS.map((city) => <option key={city} value={city} />)}</datalist></label>
      <label className={label}>Assistance request<select className={control} value={permitType} onChange={(e) => setPermitType(e.target.value as PermitType)}><option value="new">New permit assistance</option><option value="renewal">Renewal assistance</option></select></label>
      <label className={label}>Permit year<Input required type="number" min={2020} max={currentYear + 2} value={year} onChange={(e) => setYear(e.target.value)} /></label>
      <label className={label}>TaxPhil quote or service reference<Input required maxLength={100} value={assistanceReference} onChange={(e) => setAssistanceReference(e.target.value)} placeholder="Reference supplied by TaxPhil Support" /></label>
      <label className={label}>Agreed assistance fee (PHP)<Input required type="number" min={20} max={1_000_000} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
      <label className="flex items-start gap-3 rounded-lg bg-blue-50 p-4 text-sm leading-6 text-blue-900 sm:col-span-2"><input type="checkbox" required className="mt-1" checked={acknowledgedMerchant} onChange={(e) => setAcknowledged(e.target.checked)} /><span>I am paying TaxPhil for the agreed assistance service. This payment does not pay LGU taxes or fees, issue a mayor’s permit, or provide an official LGU receipt.</span></label>
    </fieldset><Button type="submit" disabled={submitting || !acknowledgedMerchant}>{submitting ? <Loader2 className="size-4 animate-spin" /> : null}{submitting ? 'Opening checkout…' : 'Review and pay on PayMongo'}</Button></form>
  </section>
}
