import { useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { BookOpen, Building2, FileText, Headphones, LayoutDashboard, MessageSquare, Receipt, Settings, X } from 'lucide-react'
import { isSupportAdminEmail } from '@/lib/support-admin-access'
import { useAuthUser } from '@/store/useAuthStore'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/income-expenses', label: 'Income & expenses', icon: Receipt },
  { to: '/tax-dues', label: 'Tax dues', icon: FileText },
  { to: '/permits', label: 'Permit assistance', icon: Building2 },
  { to: '/connect', label: 'Connect', icon: MessageSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function AppSidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const user = useAuthUser()
  const drawer = useRef<HTMLDialogElement>(null)
  const items = isSupportAdminEmail(user?.email) ? [...navItems, { to: '/admin/support', label: 'Support inbox', icon: Headphones }] : navItems
  useEffect(() => {
    if (mobileOpen && !drawer.current?.open) drawer.current?.showModal()
    if (!mobileOpen && drawer.current?.open) drawer.current?.close()
  }, [mobileOpen])
  return (
    <>
      <div className="hidden shrink-0 items-center justify-between gap-5 bg-[#103d72] px-6 text-white xl:flex">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 py-4" aria-label="TaxPhil home"><span className="flex size-9 items-center justify-center rounded-lg bg-white text-sm font-bold text-blue-800">TP</span><span className="text-xl font-semibold tracking-tight">TaxPhil.</span></Link>
        <nav aria-label="Workspace navigation" className="flex self-stretch">{items.map(({ to, label }) => <NavLink key={to} to={to} className={({ isActive }) => `inline-flex items-center border-b-[3px] px-4 pt-[3px] text-[13px] font-medium transition-colors ${isActive ? 'border-blue-300 bg-white/10 text-white' : 'border-transparent text-blue-100 hover:bg-white/5 hover:text-white'}`}>{label}</NavLink>)}</nav>
        <Link to="/accounting/overview" className="flex shrink-0 items-center gap-2 rounded-lg border border-white/25 px-3 py-2 text-sm text-white hover:bg-white/10"><BookOpen className="size-4" />UBB Accounting</Link>
      </div>
      <dialog ref={drawer} className="taxphil-nav-dialog" aria-label="TaxPhil workspace navigation" onClose={onMobileClose} onClick={event => { if (event.target === event.currentTarget) drawer.current?.close() }}>
        <div className="flex min-h-svh flex-col bg-white"><div className="flex items-center justify-between bg-[#103d72] p-5 text-white"><Link to="/" onClick={onMobileClose} className="text-xl font-semibold">TaxPhil.</Link><button type="button" onClick={() => drawer.current?.close()} aria-label="Close navigation" className="rounded-md p-2 hover:bg-white/10"><X className="size-5" /></button></div><nav aria-label="Mobile workspace navigation" className="flex-1 space-y-1 p-4"><Link to="/accounting/overview" onClick={onMobileClose} className="mb-4 flex items-center gap-3 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white"><BookOpen className="size-4" />UBB Accounting</Link>{items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onMobileClose} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><Icon className="size-4" />{label}</NavLink>)}</nav><div className="border-t border-slate-200 p-5"><p className="truncate text-sm text-slate-600">{user?.displayName || user?.email || 'Your account'}</p><Link to="/help" onClick={onMobileClose} className="mt-2 block text-sm font-medium text-blue-700">Data &amp; account help</Link></div></div>
      </dialog>
    </>
  )
}
