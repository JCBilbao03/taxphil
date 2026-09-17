import { isAccountingDemo } from '@/lib/demo-access'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, CircleHelp, Menu, Search, X } from 'lucide-react'
import { useAuthStore, useAuthUser } from '@/store/useAuthStore'
import { CompanyProvider, roleLabel, useCompany } from '@/hooks/useCompany'
import { CompanyGate } from './CompanySetup'
import { accountingModules } from './accounting-modules'
import './accounting.css'

export function AccountingLayout() {
  const user = useAuthUser()
  return <CompanyProvider><AccountingShell userName={user?.displayName || user?.email || 'My account'}><CompanyGate><Outlet /></CompanyGate></AccountingShell></CompanyProvider>
}
const groups = [
  { label: 'Dashboard', path: 'overview', items: ['overview'] },
  { label: 'Business', path: 'receivable', items: ['receivable', 'payable', 'payments', 'vendors', 'customers', 'approvals'] },
  { label: 'Payroll', path: 'payroll', items: ['employees', 'payroll'] },
  { label: 'Accounting', path: 'journal', items: ['journal', 'ledger', 'accounts', 'assets', 'bank-reconciliation', 'disbursements', 'receipts', 'settings'] },
  { label: 'Reports', path: 'reports', items: ['reports'] },
  { label: 'Tax', path: 'tax-returns', items: ['tax-returns', 'tax-mapping', 'tax-details'] },
  { label: 'Compliance', path: 'compliance', items: ['compliance', 'library', 'compliance-tracker', 'audit'] },
  { label: 'Company', path: 'company', items: ['company', 'team'] },
]
export function AccountingShell({ children, userName = 'My account' }: { children: ReactNode; userName?: string }) {
  const company = useCompany()
  const demo = isAccountingDemo(useAuthUser())
  const signOut = useAuthStore(state => state.signOut)
  const navigate = useNavigate(), location = useLocation()
  const section = location.pathname.split('/')[2] || 'overview'
  const activeGroup = groups.find(group => group.items.includes(section)) || groups[0]
  const drawer = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const initials = userName.split(/[\s@]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  const closeMenu = () => drawer.current?.close()
  function search(event: FormEvent) { event.preventDefault(); navigate(`/accounting/journal${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`) }
  return <div className="ubb-accounting ubb-shell">
    <header className="ubb-appbar">
      <button type="button" className="ubb-mobile-toggle ubb-icon-button" onClick={() => drawer.current?.showModal()} aria-label="Open accounting navigation"><Menu size={22} /></button>
      <Link className="ubb-wordmark" to="/accounting" aria-label="UBB Accounting dashboard"><span className="ubb-logo">ubb</span><span>Accounting</span></Link>
      <Link className="ubb-company-switch" to="/accounting/company"><span>{company?.company?.profile.registeredName || 'Your company'}<small>{company?.membership?.companyCode || 'Philippine workspace'}</small></span><ChevronDown size={16} /></Link>
      <nav aria-label="Accounting navigation" className="ubb-primary-nav">{groups.map(group => <NavLink key={group.path} to={`/accounting/${group.path}`} className={activeGroup.path === group.path ? 'is-active' : ''}>{group.label}</NavLink>)}</nav>
      <Link to="/accounting/compliance" className="ubb-icon-button ubb-header-help" aria-label="Philippine compliance guidance"><CircleHelp size={21} /></Link>
      {demo ? <button type="button" className="ubb-icon-button" onClick={() => { void signOut().then(() => navigate('/login')) }}>Sign out</button> : <Link to="/settings" className="ubb-avatar" aria-label={`Account settings for ${userName}`} title={userName}>{initials}</Link>}
    </header>
    <dialog ref={drawer} className="ubb-mobile-drawer" aria-label="Accounting navigation" onClick={event => { if (event.target === event.currentTarget) closeMenu() }}><div className="ubb-drawer-content"><button className="ubb-drawer-close" type="button" onClick={closeMenu} aria-label="Close navigation"><X size={22} /></button><Link className="ubb-brand" to="/accounting" onClick={closeMenu}>UBB Accounting</Link><nav className="ubb-navigation">{accountingModules.map(([id, label, Icon]) => <NavLink key={id} to={`/accounting/${id}`} onClick={closeMenu} className={`ubb-nav-item ${section === id ? 'is-active' : ''}`}><Icon size={19} />{label}</NavLink>)}</nav>{!demo && <Link className="ubb-back" to="/dashboard" onClick={closeMenu}><ArrowLeft size={16} />Back to TaxPhil</Link>}</div></dialog>
    <div className="ubb-contextbar"><nav aria-label="Section navigation">{activeGroup.items.map(id => { const item = accountingModules.find(module => module[0] === id); return item && <NavLink key={id} to={`/accounting/${id}`} className={section === id ? 'is-active' : ''}>{item[1]}</NavLink> })}</nav><form role="search" className="ubb-global-search" onSubmit={search}><Search size={17} /><input aria-label="Search all accounting transactions" placeholder="Search transactions" value={query} onChange={event => setQuery(event.target.value)} maxLength={200} /><button type="submit" aria-label="Search transactions">Search</button></form></div>
    <div className="ubb-main-column"><main id="accounting-content" className="ubb-main">{children}</main><footer className="ubb-footer"><Link to={demo ? '/accounting' : '/dashboard'}>TaxPhil · UBB Accounting</Link><span>{company?.membership ? `${company.membership.companyCode} · ${roleLabel(company.membership.role)} · PHP` : 'Philippines · PHP'} <span aria-hidden="true">·</span> {company ? 'Shared company books' : 'Isolated browser preview'}</span></footer></div>
  </div>
}
