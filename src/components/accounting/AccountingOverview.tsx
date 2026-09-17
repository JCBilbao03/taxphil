import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, BookOpen, CalendarClock, Check, CircleCheck, FilePlus2, FileText, Plus, Receipt, ShieldCheck, TrendingUp, Wallet } from 'lucide-react'
import { money, type Books, type Entry } from '@/lib/accounting'
import { accountingOverview, type OverviewBucket, type OverviewStatus } from '@/lib/accounting-overview'

type AccountingOverviewProps = {
  books: Books
  from: string
  asOf: string
  ready: boolean
  canWrite?: boolean
  canSettle?: boolean
  onCreate: (kind: 'journal' | 'payable' | 'receivable') => void
  onRecord: (kind: 'payable' | 'receivable') => void
}

const panel = 'min-w-0 rounded-xl border border-[#dfe7ee] bg-white'
const link = 'inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold text-[#087cc1] transition-colors hover:text-[#065b8f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087cc1]'
const actionBase = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087cc1] disabled:cursor-not-allowed disabled:opacity-45'
const action = `${actionBase} border-[#dce5ed] bg-white text-[#29445e] hover:border-[#8ebec4] hover:bg-[#f3f9fa]`
const shortDate = (date: string) => new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
const sourceLabels: Record<Entry['source'], string> = { journal: 'Journal entry', payable: 'Supplier bill', receivable: 'Customer invoice', payment: 'Supplier payment', receipt: 'Customer receipt', reversal: 'Reversal' }
const statusStyles: Record<OverviewStatus, string> = {
  Posted: 'bg-[#edf4f8] text-[#486078]', Unpaid: 'bg-[#edf4f8] text-[#486078]', 'Part-paid': 'bg-[#fdf3de] text-[#91661f]',
  Overdue: 'bg-[#fdf0e6] text-[#9b5823]', Paid: 'bg-[#e8f5ef] text-[#2e765d]', Recorded: 'bg-[#e8f5ef] text-[#2e765d]',
  Reversed: 'bg-[#f1f2f4] text-[#5f6873]', 'Reversal posted': 'bg-[#f1f2f4] text-[#5f6873]',
}

function IncomeChart({ buckets, empty, ready }: { buckets: OverviewBucket[]; empty: boolean; ready: boolean }) {
  const width = 660, height = 232, left = 76, right = 18, top = 16, bottom = 39
  const plotHeight = height - top - bottom, plotWidth = width - left - right
  const allValues = buckets.flatMap(bucket => [bucket.income, bucket.expenses])
  const maximum = Math.max(0, ...allValues), minimum = Math.min(0, ...allValues)
  const span = maximum - minimum || 1
  const upper = maximum || (minimum === 0 ? 1 : 0), lower = minimum
  const y = (value: number) => top + (upper - value) / span * plotHeight
  const baseline = y(0), slot = plotWidth / buckets.length, barWidth = Math.min(25, slot * 0.26)
  const hasValues = maximum !== 0 || minimum !== 0
  const compactMoney = (cents: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100)
  const ticks = hasValues ? Array.from({ length: 4 }, (_, index) => upper - (upper - lower) * index / 3) : [1, 2 / 3, 1 / 3, 0]
  return <div className="relative mt-4 min-w-0">
    <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full min-w-0" role="img" aria-label={ready ? empty ? 'Income and expenses chart: no activity in the selected period. All totals are zero.' : 'Income and expenses by period, in Philippine pesos. Negative bars include reversals and adjustments.' : 'Income and expenses chart: books are not yet available.'}>
      {ticks.map((value, index) => <g key={index}>
        <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#e8edf2" strokeDasharray="3 4" />
        {(hasValues || index === ticks.length - 1) && <text x={left - 12} y={y(value) + 4} textAnchor="end" fill="#526b84" fontSize="11">{hasValues ? compactMoney(value) : '₱0.00'}</text>}
      </g>)}
      <line x1={left} x2={width - right} y1={baseline} y2={baseline} stroke="#cdd9e3" />
      {buckets.map((bucket, index) => {
        const center = left + slot * (index + 0.5)
        return <g key={bucket.key}>
          {[{ value: bucket.income, color: '#168dcc', label: 'Income', x: center - barWidth - 3 }, { value: bucket.expenses, color: '#a8bbce', label: 'Expenses', x: center + 3 }].map(bar => <rect key={bar.label} x={bar.x} y={Math.min(baseline, y(bar.value))} width={barWidth} height={Math.abs(baseline - y(bar.value))} rx="3" fill={bar.color}><title>{bucket.label}: {bar.label} {money(bar.value)}</title></rect>)}
          <text x={center} y={height - 12} textAnchor="middle" fill="#526b84" fontSize={bucket.label.length > 12 ? '10' : '11'}>{bucket.label}</text>
        </g>
      })}
    </svg>
    {(empty || !ready) && <div className="pointer-events-none absolute inset-x-16 top-[27%] text-center"><p className="inline-block bg-white/95 px-3 py-1.5 text-[14px] font-medium text-[#526a80]">{ready ? 'No income or expenses yet' : 'Waiting for your books'}</p><p className="mx-auto max-w-64 bg-white/95 px-2 pb-1 text-[12px] leading-relaxed text-[#526b84]">{ready ? 'Your chart updates as you record transactions.' : 'Your figures will appear when the books are ready.'}</p></div>}
  </div>
}

export function AccountingOverview({ books, from, asOf, ready, canWrite = true, canSettle = true, onCreate, onRecord }: AccountingOverviewProps) {
  const data = useMemo(() => accountingOverview(books, from, asOf), [books, from, asOf])
  const period = from ? `${shortDate(from)} – ${shortDate(asOf)}` : `All activity through ${shortDate(asOf)}`
  const overdueTotal = data.overdue.reduce((sum, invoice) => sum + invoice.open, 0)
  const dueSoonTotal = data.dueSoon.reduce((sum, invoice) => sum + invoice.open, 0)
  const cards = [
    { label: 'Cash & bank', value: data.cash, icon: Wallet, path: 'ledger', caption: `Cash balance as of ${shortDate(asOf)}`, detail: 'View ledger' },
    { label: 'Customers owe you', value: data.receivable, icon: ArrowDownLeft, path: 'receivable', caption: `Unpaid invoices as of ${shortDate(asOf)}`, detail: 'View receivables' },
    { label: 'You owe suppliers', value: data.payable, icon: ArrowUpRight, path: 'payable', caption: `Unpaid bills as of ${shortDate(asOf)}`, detail: 'View payables' },
    { label: 'Net profit', value: data.profit, icon: TrendingUp, path: 'reports', caption: from ? `${shortDate(from)} – ${shortDate(asOf)}` : 'All activity through the selected date', detail: 'View reports' },
  ]
  return <div className="space-y-5 text-[#102d50]" aria-busy={!ready}>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => <section key={card.label} className={`${panel} p-5`}>
        <div className="flex items-center justify-between gap-2"><h2 className="text-[14px] font-medium text-[#60748a]">{card.label}</h2><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eef6f7] text-[#087cc1]"><card.icon className="size-[18px]" strokeWidth={1.7} aria-hidden="true" /></span></div>
        <p className={`mt-3 break-words text-[clamp(1.6rem,2.25vw,2rem)] leading-tight font-semibold tracking-tight tabular-nums ${card.value < 0 ? 'text-[#ad613a]' : 'text-[#143659]'}`}>{ready ? money(card.value) : '—'}</p>
        <p className="mt-2 min-h-8 text-[12px] leading-4 text-[#526b84]">{card.caption}</p>
        <div className="mt-3 border-t border-[#edf1f5] pt-3"><NavLink to={`/accounting/${card.path}`} className={link}>{card.detail}<ArrowRight className="size-3.5" aria-hidden="true" /></NavLink></div>
      </section>)}
    </div>

    <section className={`${panel} flex flex-wrap items-center justify-between gap-4 px-5 py-4`} aria-label="Quick actions">
      <div className="flex items-center gap-2.5"><span className="flex size-8 items-center justify-center rounded-lg bg-[#f1f5f8] text-[#60748a]"><Plus className="size-4" aria-hidden="true" /></span><h2 className="text-[14px] font-semibold">Quick actions</h2></div>
      <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:flex-wrap">
        <button type="button" disabled={!ready || !canWrite} onClick={() => onCreate('receivable')} className={`${actionBase} border-[#087cc1] bg-[#087cc1] text-white hover:border-[#06679f] hover:bg-[#06679f]`}><FilePlus2 className="size-4" aria-hidden="true" />Create invoice</button>
        <button type="button" disabled={!ready || !canWrite} onClick={() => onCreate('payable')} className={action}><FileText className="size-4 text-[#6c8499]" aria-hidden="true" />Add supplier bill</button>
        <button type="button" disabled={!ready || !canSettle} onClick={() => onRecord('receivable')} className={action}><ArrowDownLeft className="size-4 text-[#6c8499]" aria-hidden="true" />Record receipt</button>
        <button type="button" disabled={!ready || !canSettle} onClick={() => onRecord('payable')} className={action}><ArrowUpRight className="size-4 text-[#6c8499]" aria-hidden="true" />Record payment</button>
      </div>
    </section>

    <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
      <section className={`${panel} flex flex-col p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[15px] font-semibold">Income & expenses</h2><p className="mt-1 text-[12px] text-[#526b84]">{period}</p></div><NavLink to="/accounting/reports" className={link}>View report<ArrowRight className="size-3.5" aria-hidden="true" /></NavLink></div>
        <div className="mt-5 flex items-center justify-between gap-3 text-[12px] text-[#526b84]"><span>{data.bucketMonths === 1 ? 'Monthly totals' : `${data.bucketMonths}-month totals`} · PHP</span><div className="flex gap-4"><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#168dcc]" />Income</span><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#a8bbce]" />Expenses</span></div></div>
        <IncomeChart buckets={data.buckets} empty={!data.hasIncomeExpenseActivity} ready={ready} />
        <div className="mt-auto grid grid-cols-2 gap-4 border-t border-[#e9eef3] pt-4">
          <div><p className="flex items-center gap-1.5 text-[12px] text-[#526b84]"><span className="size-2 rounded-full bg-[#168dcc]" />Total income</p><p className="mt-1.5 text-lg font-semibold tabular-nums">{ready ? money(data.income) : '—'}</p></div>
          <div className="border-l border-[#e9eef3] pl-5"><p className="flex items-center gap-1.5 text-[12px] text-[#526b84]"><span className="size-2 rounded-full bg-[#a8bbce]" />Total expenses</p><p className="mt-1.5 text-lg font-semibold tabular-nums">{ready ? money(data.expenses) : '—'}</p></div>
        </div>
      </section>

      <section className={`${panel} flex flex-col p-5 sm:p-6`}>
        <div className="flex items-center justify-between gap-3"><h2 className="text-[15px] font-semibold">Needs your attention</h2><span className="rounded-md bg-[#f0f4f8] px-2 py-1 text-[12px] font-medium text-[#526b84]">As of {shortDate(asOf)}</span></div>
        <div className="mt-5 flex flex-1 flex-col divide-y divide-[#e9eef3]">
          <NavLink to="/accounting/receivable?status=overdue" className="group flex items-start gap-3 rounded-sm py-4 first:pt-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087cc1]">
            <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${data.overdue.length ? 'bg-[#fff4e7] text-[#bb822f]' : 'bg-[#edf6f5] text-[#4d908a]'}`}><Receipt className="size-[18px]" strokeWidth={1.7} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p className="text-[14px] font-semibold">{!ready ? 'Customer invoices' : data.overdue.length ? `${data.overdue.length} overdue invoice${data.overdue.length === 1 ? '' : 's'}` : 'No overdue invoices'}</p><p className="mt-1 text-[12px] leading-4 text-[#526b84]">{ready ? `${money(overdueTotal)} awaiting collection` : 'Available when your books are ready'}</p><span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#087cc1]">View invoices<ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span></div>
            {ready && !data.overdue.length && <Check className="mt-1 size-4 shrink-0 text-[#6a9e8c]" aria-label="No overdue invoices" />}
          </NavLink>
          <NavLink to="/accounting/payable?status=due-soon" className="group flex items-start gap-3 rounded-sm py-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087cc1]">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#edf3f9] text-[#6989aa]"><CalendarClock className="size-[18px]" strokeWidth={1.7} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p className="text-[14px] font-semibold">{!ready ? 'Upcoming supplier bills' : data.dueSoon.length ? `${data.dueSoon.length} bill${data.dueSoon.length === 1 ? '' : 's'} due in 7 days` : 'No bills due in 7 days'}</p><p className="mt-1 text-[12px] leading-4 text-[#526b84]">{ready ? `${money(dueSoonTotal)} · through ${shortDate(data.dueThrough)}` : 'Available when your books are ready'}</p><span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#087cc1]">View bills<ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span></div>
            {ready && !data.dueSoon.length && <Check className="mt-1 size-4 shrink-0 text-[#6a9e8c]" aria-label="No upcoming bills" />}
          </NavLink>
          <NavLink to="/accounting/reports" className="group flex items-start gap-3 rounded-sm py-4 last:pb-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#087cc1]">
            <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${ready && data.trialDifference !== 0 ? 'bg-[#fff4e7] text-[#bb822f]' : 'bg-[#edf6f5] text-[#4d908a]'}`}><ShieldCheck className="size-[18px]" strokeWidth={1.7} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p className="text-[14px] font-semibold">{!ready ? 'Trial balance check pending' : data.trialDifference === 0 ? 'Your trial balance is balanced' : 'Review your trial balance'}</p><p className="mt-1 text-[12px] leading-4 text-[#526b84]">{!ready ? 'Checked when your books are ready' : data.trialDifference === 0 ? 'Total debits and credits match.' : `${money(Math.abs(data.trialDifference))} difference to review`}</p><span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#087cc1]">View trial balance<ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span></div>
            {ready && data.trialDifference === 0 && <CircleCheck className="mt-1 size-4 shrink-0 text-[#6a9e8c]" aria-label="Balanced" />}
          </NavLink>
        </div>
      </section>
    </div>

    <section className={`${panel} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6"><div><h2 className="text-[15px] font-semibold">Recent transactions</h2><p className="mt-1 text-[12px] text-[#526b84]">Latest postings in the selected period</p></div><NavLink to="/accounting/journal" className={link}>View all transactions<ArrowRight className="size-3.5" aria-hidden="true" /></NavLink></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-[14px]"><thead className="border-y border-[#e7edf2] bg-[#f7f9fb] text-[12px] font-medium tracking-wide text-[#526b84]"><tr>{['Date', 'Description', 'Type', 'Amount', 'Status'].map(header => <th key={header} scope="col" className={`px-5 py-3 font-medium sm:px-6 ${header === 'Amount' ? 'text-right' : ''}`}>{header}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#edf1f5]">{ready && data.recent.map(entry => <tr key={entry.id} className="transition-colors hover:bg-[#fafcfd]"><td className="whitespace-nowrap px-5 py-4 text-[#526b84] sm:px-6">{shortDate(entry.date)}</td><td className="max-w-80 px-5 py-4 sm:px-6"><p className="truncate font-medium" title={entry.description}>{entry.description}</p><p className="mt-1 text-[12px] text-[#526b84]">{entry.reference}</p></td><td className="whitespace-nowrap px-5 py-4 text-[#526b84] sm:px-6">{sourceLabels[entry.source]}</td><td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums sm:px-6">{money(entry.amount)}</td><td className="whitespace-nowrap px-5 py-4 sm:px-6"><span className={`inline-flex rounded-md px-2 py-1 text-[12px] font-medium ${statusStyles[entry.status]}`}>{entry.status}</span></td></tr>)}</tbody>
      </table></div>
      {(!ready || !data.recent.length) && <div className="flex flex-col items-center px-5 py-10 text-center"><span className="mb-3 flex size-11 items-center justify-center rounded-xl border border-[#e3ebf1] bg-[#f7fafc] text-[#8198ac]"><BookOpen className="size-5" strokeWidth={1.5} aria-hidden="true" /></span><h3 className="text-sm font-semibold">{ready ? 'Your first transaction starts here' : 'Waiting for your books'}</h3><p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#526b84]">{ready ? 'Create an invoice, add a supplier bill, or record your opening balances.' : 'Your recent transactions will appear when the books are ready.'}</p>{ready && canWrite && <button type="button" onClick={() => onCreate('journal')} className={`${link} mt-4`}><Plus className="size-3.5" aria-hidden="true" />Create journal entry</button>}</div>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e9eef3] px-5 py-3 text-[12px] text-[#526b84] sm:px-6"><span className="inline-flex items-center gap-1.5"><BarChart3 className="size-3" aria-hidden="true" />All amounts in Philippine pesos (PHP)</span><span>Recorded from your books</span></div>
    </section>
  </div>
}
