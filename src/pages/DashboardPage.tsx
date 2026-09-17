import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, BookOpen, CalendarDays, FileText, Plus } from 'lucide-react'
import { TaxDuesSummaryCard } from '@/components/dashboard/TaxDuesSummaryCard'
import { UnpaidPermitCard } from '@/components/dashboard/UnpaidPermitCard'
import { useTaxStore } from '@/store/useTaxStore'
import { formatCurrency } from '@/lib/utils'
import { dashboardSummary, type DashboardPeriod } from '@/lib/dashboard-summary'
import { today } from '@/lib/accounting'
import { trackingDateLabel } from '@/lib/tax-workflows'

export function DashboardPage() {
  const { income, expenses, deadlines, loading, error } = useTaxStore()
  const [period, setPeriod] = useState<DashboardPeriod>('quarter')
  const summary = dashboardSummary(income, expenses, deadlines, period, today())
  const metrics = [
    { title: 'Recorded income', amount: summary.income, icon: ArrowDownLeft },
    { title: 'Recorded expenses', amount: summary.expenses, icon: ArrowUpRight },
    { title: 'Income less expenses', amount: summary.net, icon: BookOpen },
  ]
  return <div className="mx-auto max-w-6xl space-y-6">
    <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Personal financial tracker</p><h2 className="mt-2 text-xl font-semibold text-slate-900">Your records at a glance</h2><p className="mt-2 text-sm text-slate-500">{period === 'all' ? 'All records through ' : `${trackingDateLabel(summary.from)} – `}{trackingDateLabel(summary.to)}</p></div><label className="grid gap-1 text-xs font-medium text-slate-500">Reporting period<select className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800" value={period} onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}><option value="month">Month to date</option><option value="quarter">Quarter to date</option><option value="year">Year to date</option><option value="all">All time</option></select></label></section>
    {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Your records could not be fully loaded. {error}</p> : null}
    <div className="grid gap-4 sm:grid-cols-3">{metrics.map(({ title, amount, icon: Icon }) => <section key={title} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium text-slate-500">{title}</h3><Icon className="size-4 text-primary" /></div><p className="mt-4 text-2xl font-semibold tabular-nums text-slate-900">{loading || error ? '—' : formatCurrency(amount)}</p><p className="mt-2 text-xs text-slate-500">{loading ? 'Loading saved records…' : error ? 'Unavailable until records load' : 'From your income and expense tracker'}</p></section>)}</div>
    <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]"><TaxDuesSummaryCard /><section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Keep work moving</h2><CalendarDays className="size-5 text-primary" /></div><div className="mt-5 grid grid-cols-3 gap-3">{[{ label: 'Overdue', value: summary.overdue }, { label: 'Due this quarter', value: summary.dueThisQuarter }, { label: 'Total pending', value: summary.totalPending }].map((item) => <div key={item.label} className="rounded-lg bg-slate-50 p-3"><p className="text-xl font-semibold tabular-nums text-slate-900">{loading || error ? '—' : item.value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{item.label}</p></div>)}</div><div className="mt-5 space-y-2">{[{ to: '/income-expenses', text: 'Manage income and expenses', icon: Plus }, { to: '/tax-dues?new=1', text: 'Add a reviewed tax obligation', icon: CalendarDays }, { to: '/accounting/overview', text: 'Open UBB Accounting', icon: BookOpen }, { to: '/accounting/compliance', text: 'Open company compliance', icon: FileText }].map(({ to, text, icon: Icon }) => <Link key={to} to={to} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-3 text-sm font-medium text-primary hover:bg-blue-50"><Icon className="size-4" />{text}<ArrowUpRight className="ml-auto size-4" /></Link>)}</div></section></div>
    <UnpaidPermitCard />
    <p className="text-xs leading-6 text-slate-500">These figures summarize your personal tracker entries. Company books and tax working papers are available in UBB Accounting. Recorded obligations need review against your registration and applicable filing rules.</p>
  </div>
}
