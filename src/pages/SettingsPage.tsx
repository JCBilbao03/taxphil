import { useEffect, useState, type FormEvent } from 'react'
import { updateProfile } from 'firebase/auth'
import { ArrowRight, Building2, CheckCircle2, FileText, LockKeyhole, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getUserProfile, updateUserProfile, updateUserRegistration } from '@/lib/firestore/user-profile'
import { normalizePersonalProfile, normalizePersonalRegistration, personalTaxpayerTypes } from '@/lib/profile-validation'
import { auth } from '@/lib/firebase'
import { useAuthStore, useAuthUser } from '@/store/useAuthStore'

const emptyForm = { fullName: '', tin: '', businessName: '', taxType: '', rdo: '' }

export function SettingsPage() {
  const user = useAuthUser()
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [saving, setSaving] = useState<'profile' | 'registration' | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const uid = user?.uid
  useEffect(() => {
    let cancelled = false
    if (!uid) return
    setLoading(true); setLoadError(''); setMessage(''); setError('')
    getUserProfile(uid).then(profile => {
      if (!cancelled) setForm({ fullName: profile?.fullName || auth.currentUser?.displayName || '', tin: profile?.tin || '', businessName: profile?.businessName || '', taxType: profile?.taxType || '', rdo: profile?.rdo || '' })
    }).catch(reason => { if (!cancelled) setLoadError(reason instanceof Error ? reason.message : 'Your profile could not be loaded.') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [uid, reload])
  function field(key: keyof typeof form, value: string) { setForm(current => ({ ...current, [key]: value })); setMessage(''); setError('') }
  const disabled = loading || Boolean(loadError) || saving !== null
  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!uid || disabled || auth.currentUser?.uid !== uid) return
    setError(''); setMessage('')
    let saved = false
    try {
      const clean = normalizePersonalProfile(form)
      setSaving('profile')
      await updateUserProfile(uid, { email: user?.email || '', displayName: clean.fullName }, { ...clean, displayName: clean.fullName })
      saved = true
      if (auth.currentUser?.uid !== uid) throw Error('The signed-in account changed. Reload this page to continue.')
      await updateProfile(auth.currentUser, { displayName: clean.fullName })
      useAuthStore.setState({ user: auth.currentUser })
      setForm(current => ({ ...current, ...clean }))
      setMessage('Your profile and account display name have been updated.')
    } catch (reason) { setError(`${saved ? 'Profile details were saved, but the account display name could not be updated. Save again to retry. ' : ''}${reason instanceof Error ? reason.message : 'Unable to save your profile.'}`) }
    finally { setSaving(null) }
  }
  async function saveRegistration(event: FormEvent) {
    event.preventDefault()
    if (!uid || disabled || auth.currentUser?.uid !== uid) return
    setError(''); setMessage('')
    try {
      const clean = normalizePersonalRegistration(form)
      setSaving('registration')
      await updateUserRegistration(uid, { email: user?.email || '', displayName: user?.displayName || form.fullName }, clean)
      setForm(current => ({ ...current, ...clean }))
      setMessage('Your personal registration details have been saved. This does not change your registration with BIR.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save registration details.') }
    finally { setSaving(null) }
  }
  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-4"><div className="flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><User className="size-6" /></div><div><h2 className="text-lg font-semibold">Your personal workspace</h2><p className="mt-1 break-all text-sm text-slate-500">{user?.email}</p></div></div>{user?.emailVerified && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-3.5" />Email verified</span>}</div>
    {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {(error || loadError) && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error || loadError}</p>{loadError && <button type="button" className="mt-2 font-semibold underline" onClick={() => setReload(value => value + 1)}>Try loading again</button>}</div>}
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"><div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-semibold">Profile details</h2><p className="mt-2 text-sm leading-7 text-slate-500">Your account name and the taxpayer details you keep in your personal workspace.</p><form onSubmit={saveProfile} className="mt-6 space-y-5"><div className="space-y-2"><Label htmlFor="fullName">Full name</Label><Input id="fullName" autoComplete="name" required maxLength={120} value={form.fullName} disabled={disabled} onChange={event => field('fullName', event.target.value)} /></div><div className="space-y-2"><Label htmlFor="tin">TIN and branch code, if applicable</Label><Input id="tin" inputMode="text" maxLength={22} placeholder="000-000-000" value={form.tin} disabled={disabled} onChange={event => field('tin', event.target.value)} /><p className="text-xs leading-6 text-slate-500">Use the number on your registration. You can leave it blank until available.</p></div><div className="space-y-2"><Label htmlFor="businessName">Business or trade name</Label><Input id="businessName" maxLength={200} value={form.businessName} disabled={disabled} onChange={event => field('businessName', event.target.value)} /></div><Button disabled={disabled} type="submit">{saving === 'profile' ? 'Saving…' : 'Save profile'}</Button></form></section>
      <section className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-semibold">Personal tax registration</h2><p className="mt-2 text-sm leading-7 text-slate-500">Record the details shown on your registration. These fields do not select a tax rate or file a return.</p><form onSubmit={saveRegistration} className="mt-6 space-y-5"><div className="space-y-2"><Label htmlFor="taxType">Taxpayer type</Label><select id="taxType" required disabled={disabled} value={form.taxType} onChange={event => field('taxType', event.target.value)} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">Select taxpayer type</option>{form.taxType && !personalTaxpayerTypes.some(value => value === form.taxType) && <option value={form.taxType}>{form.taxType} (previous entry — choose an updated option)</option>}{personalTaxpayerTypes.map(value => <option key={value}>{value}</option>)}</select></div><div className="space-y-2"><Label htmlFor="rdo">RDO code</Label><Input id="rdo" placeholder="e.g. 039 or 008A" maxLength={12} value={form.rdo} disabled={disabled} onChange={event => field('rdo', event.target.value)} /></div><Button type="submit" disabled={disabled} variant="outline">{saving === 'registration' ? 'Saving…' : 'Save registration details'}</Button></form></section>
    </div><aside className="space-y-6"><section className="rounded-xl bg-[#103d72] p-6 text-white"><Building2 className="size-6 text-blue-200" /><h2 className="mt-4 text-lg font-semibold">Looking for company settings?</h2><p className="mt-3 text-sm leading-7 text-blue-100">Your company’s registered details, users, permissions, and accounting setup live in UBB Accounting.</p><Link to="/accounting/company" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white">Open company settings<ArrowRight className="size-4" /></Link></section><section className="rounded-xl border border-slate-200 bg-white p-6"><FileText className="size-6 text-blue-700" /><h2 className="mt-4 text-lg font-semibold">Preparing company tax returns</h2><p className="mt-3 text-sm leading-7 text-slate-600">Review the accounting-to-tax setup and your company’s records before preparing a draft return.</p><Link to="/accounting/tax-returns" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">Open tax preparation<ArrowRight className="size-4" /></Link></section><section className="rounded-xl border border-slate-200 bg-white p-6"><LockKeyhole className="size-6 text-blue-700" /><h2 className="mt-4 text-lg font-semibold">Account and data help</h2><p className="mt-3 text-sm leading-7 text-slate-600">Find help with access, exports, and questions about your records.</p><Link to="/help" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">Read the help guide<ArrowRight className="size-4" /></Link></section></aside></div>
  </div>
}
