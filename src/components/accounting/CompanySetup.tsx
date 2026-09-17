import { useState, type FormEvent, type ReactNode } from 'react'
import { Building2, KeyRound } from 'lucide-react'
import { useCompany } from '@/hooks/useCompany'
import { CompanyProfileForm } from './CompanyPanels'
import { Button } from '@/components/ui/button'
import { useAuthUser } from '@/store/useAuthStore'
import { exportPersonalBooks } from '@/lib/legacy-accounting'

export function CompanyGate({ children }: { children: ReactNode }) {
  const user = useAuthUser()
  const company = useCompany()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [companyCode, setCompanyCode] = useState(''), [inviteCode, setInviteCode] = useState(''), [error, setError] = useState('')
  if (!company) return children
  if (company.loading) return <div className="company-empty" role="status">Loading your company…</div>
  if (company.membership && !company.membership.active) return <div className="company-empty"><KeyRound size={32} /><h1>Your company access is inactive</h1><p>Ask your Company Admin to restore your membership.</p></div>
  if (company.membership && company.company) return children
  if (company.error) return <div className="company-empty" role="alert"><Building2 size={32} /><h1>Company service needs attention</h1><p>{company.error}</p><Button onClick={() => window.location.reload()}>Try again</Button></div>
  if (company.membership) return <div className="company-empty" role="status">Loading company records…</div>
  async function join(event: FormEvent) {
    event.preventDefault(); setError('')
    try { await company!.invoke('companyJoin', { companyCode: companyCode.trim().toUpperCase(), inviteCode: inviteCode.trim() }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not join the company.') }
  }
  return <div className="company-onboarding">
    <div className="company-onboarding-heading"><span className="company-setup-icon"><Building2 size={26} /></span><p className="ubb-eyebrow">Philippine accounting</p><h1>Set up your company workspace</h1><p>One company. Shared books. The right access for every member of your team.</p></div>
    <div className="company-setup-tabs" role="group" aria-label="Company setup options"><button type="button" aria-pressed={mode === 'create'} onClick={() => setMode('create')}>Create a company</button><button type="button" aria-pressed={mode === 'join'} onClick={() => setMode('join')}>Join with an invitation</button></div>
    {mode === 'create' ? <CompanyProfileForm submitLabel="Create company workspace" onSave={async profile => { await company.invoke('companyCreate', { profile }) }} /> : <form className="company-join" onSubmit={join}><h2>Join your team</h2><p>Use the company code and private invitation code supplied by your administrator. Your signed-in email must match the invitation.</p><label>Company code<input required maxLength={30} value={companyCode} onChange={event => setCompanyCode(event.target.value.toUpperCase())} placeholder="PH-XXXXXXXX" autoComplete="off" /></label><label>Invitation code<input required value={inviteCode} onChange={event => setInviteCode(event.target.value)} autoComplete="off" /></label>{error && <p role="alert" className="text-red-700">{error}</p>}<Button type="submit" disabled={company.busy}>{company.busy ? 'Joining…' : 'Join company'}</Button></form>}
    {user && <div className="mt-6"><Button variant="outline" onClick={() => { try { exportPersonalBooks(user.uid); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Export failed.') } }}>Export previous personal books</Button>{mode === 'create' && error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</div>}
    <p className="company-setup-note">Company records are shared with authorized members. Existing personal browser books remain separate; review and export them before arranging a migration.</p>
  </div>
}
