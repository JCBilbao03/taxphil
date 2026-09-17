import { useRef, useState } from 'react'
import { Bell, CalendarDays, LogOut, Menu, MessageSquare, User, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/useAuthStore'
import { useTaxStore } from '@/store/useTaxStore'
import { useConnectStore } from '@/store/useConnectStore'
import { formatCurrency } from '@/lib/utils'

export function AppHeader({ title, description, onMenuClick, showTaxSummary = true }: { title: string; description?: string; onMenuClick?: () => void; showTaxSummary?: boolean }) {
  const navigate = useNavigate()
  const accountName = useAuthStore(state => state.user?.displayName || state.user?.email || 'My account')
  const signOut = useAuthStore(state => state.signOut)
  const income = useTaxStore(state => state.income)
  const expenses = useTaxStore(state => state.expenses)
  const deadlines = useTaxStore(state => state.deadlines)
  const dataLoading = useTaxStore(state => state.loading)
  const dataError = useTaxStore(state => state.error)
  const conversations = useConnectStore(state => state.conversations)
  const chatError = useConnectStore(state => state.chatError)
  const setConversation = useConnectStore(state => state.setActiveConversation)
  const notificationDialog = useRef<HTMLDialogElement>(null)
  const [signOutError, setSignOutError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const currentYear = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric' }).format(new Date())
  const ytd = (rows: typeof income) => rows.filter(row => row.date.startsWith(currentYear)).reduce((sum, row) => sum + Math.round(row.amount * 100), 0)
  const netIncome = (ytd(income) - ytd(expenses)) / 100
  const pending = deadlines.filter(row => row.status !== 'filed').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const unread = conversations.filter(row => row.unread > 0)
  const notificationCount = pending.length + unread.reduce((sum, row) => sum + row.unread, 0)
  const handleSignOut = async () => {
    setSignOutError(''); setSigningOut(true)
    try { await signOut(); navigate('/login') }
    catch (error) { setSignOutError(error instanceof Error ? error.message : 'Sign out failed. Please try again.') }
    finally { setSigningOut(false) }
  }
  return (
    <>
      <header className="flex min-h-24 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">{onMenuClick && <Button variant="outline" size="icon" className="shrink-0 xl:hidden" onClick={onMenuClick} aria-label="Open navigation menu"><Menu className="size-5" /></Button>}<div className="min-w-0"><h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>{description && <p className="mt-1 hidden max-w-2xl text-sm text-slate-500 sm:block">{description}</p>}</div></div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">{showTaxSummary && <div className="mr-2 hidden border-r border-slate-200 pr-5 text-right 2xl:block"><p className="text-xs text-slate-500">Personal net income · {currentYear}</p><p className="mt-1 text-sm font-semibold text-slate-900">{dataError ? 'Unavailable' : dataLoading ? 'Loading…' : formatCurrency(netIncome)}</p></div>}
          <Button variant="outline" size="icon" className="relative" onClick={() => notificationDialog.current?.showModal()} aria-label={`Notifications, ${notificationCount} pending items`}><Bell className="size-4" />{notificationCount > 0 && <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-blue-700 px-1 text-[10px] text-white">{notificationCount > 99 ? '99+' : notificationCount}</span>}</Button>
          <Link to="/settings" className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50" aria-label="My account settings"><User className="size-4" /><span className="hidden max-w-32 truncate md:inline">{accountName}</span></Link>
          <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut} aria-label="Sign out"><LogOut className="size-4" /><span className="hidden sm:inline">{signingOut ? 'Signing out…' : 'Sign out'}</span></Button>
        </div>
        {signOutError && <p role="alert" className="w-full text-sm text-red-700">{signOutError}</p>}
      </header>
      <dialog ref={notificationDialog} className="taxphil-notification-dialog" aria-labelledby="notification-title" onClick={event => { if (event.target === event.currentTarget) notificationDialog.current?.close() }}><div className="bg-white"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 id="notification-title" className="text-lg font-semibold text-slate-900">Your notifications</h2><p className="mt-1 text-sm text-slate-500">Messages and recorded obligations</p></div><Button variant="ghost" size="icon" onClick={() => notificationDialog.current?.close()} aria-label="Close notifications"><X className="size-5" /></Button></div><div className="space-y-5 p-5">
        {(dataError || chatError) && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">Some notifications could not be loaded. Open the relevant workspace to check its connection.</p>}
        {dataLoading && <p className="text-sm text-slate-500">Loading your recorded obligations…</p>}
        <div><h3 className="text-sm font-semibold text-slate-900">Unread conversations</h3>{unread.length === 0 ? <p className="mt-2 text-sm text-slate-500">{chatError ? 'Messages unavailable.' : 'No unread conversations.'}</p> : <ul className="mt-2 divide-y divide-slate-100">{unread.map(row => <li key={row.id}><button onClick={() => { setConversation(row.id); notificationDialog.current?.close(); navigate('/connect') }} className="flex w-full gap-3 py-3 text-left"><MessageSquare className="mt-1 size-4 shrink-0 text-blue-600" /><div><p className="text-sm font-medium text-slate-900">{row.name} · {row.unread} unread</p><p className="mt-1 line-clamp-2 text-sm text-slate-500">{row.lastMessage || 'Open conversation'}</p></div></button></li>)}</ul>}</div>
        <div><h3 className="text-sm font-semibold text-slate-900">Pending obligations</h3>{pending.length === 0 ? <p className="mt-2 text-sm text-slate-500">{dataError ? 'Obligations unavailable.' : 'No pending obligations recorded.'}</p> : <ul className="mt-2 divide-y divide-slate-100">{pending.slice(0, 5).map(row => <li key={row.id}><Link to="/tax-dues" onClick={() => notificationDialog.current?.close()} className="flex gap-3 py-3"><CalendarDays className="mt-1 size-4 shrink-0 text-blue-600" /><div><p className="text-sm font-medium text-slate-900">{row.formType} · {row.title}</p><p className="mt-1 text-sm text-slate-500">Recorded due date: {row.dueDate}</p></div></Link></li>)}</ul>}<Link to="/tax-dues" onClick={() => notificationDialog.current?.close()} className="mt-4 inline-block text-sm font-semibold text-blue-700">View all tax obligations →</Link></div>
      </div></div></dialog>
    </>
  )
}
