import { balances, isReversed, outstanding, type Books, type Entry } from './accounting.ts'

export type OverviewBucket = { key: string; label: string; from: string; to: string; income: number; expenses: number }
export type OverviewStatus = 'Posted' | 'Unpaid' | 'Part-paid' | 'Overdue' | 'Paid' | 'Recorded' | 'Reversed' | 'Reversal posted'

const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1
const monthStart = (index: number) => `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}-01`
const monthLabel = (index: number, year = false) => new Intl.DateTimeFormat('en-PH', { month: 'short', ...(year ? { year: '2-digit' } : {}), timeZone: 'UTC' }).format(new Date(`${monthStart(index)}T00:00:00Z`))

export function addOverviewDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

export function overviewEntryStatus(books: Books, entry: Entry, asOf: string): OverviewStatus {
  if (isReversed(books, entry.id, asOf)) return 'Reversed'
  if (entry.source === 'reversal') return 'Reversal posted'
  const invoice = books.invoices.find(item => item.entryId === entry.id)
  if (invoice) {
    const open = outstanding(books, invoice, asOf)
    if (open === 0) return 'Paid'
    if (invoice.due < asOf) return 'Overdue'
    return open < invoice.amount ? 'Part-paid' : 'Unpaid'
  }
  return entry.source === 'receipt' || entry.source === 'payment' ? 'Recorded' : 'Posted'
}

export function accountingOverview(books: Books, from: string, asOf: string) {
  const periodEntries = books.entries.filter(entry => entry.date >= from && entry.date <= asOf)
  const allBalances = balances(books, '', asOf)
  const accountTypes = new Map(books.accounts.map(account => [account.code, account.type]))
  const datedInvoices = books.invoices.filter(invoice => invoice.date <= asOf)
  const openInvoices = datedInvoices.map(invoice => ({ ...invoice, open: outstanding(books, invoice, asOf) })).filter(invoice => invoice.open > 0)
  const dueThrough = addOverviewDays(asOf, 6)
  const overdue = openInvoices.filter(invoice => invoice.kind === 'receivable' && invoice.due < asOf)
  const dueSoon = openInvoices.filter(invoice => invoice.kind === 'payable' && invoice.due >= asOf && invoice.due <= dueThrough)

  // Without a selected start date, show all posted activity; empty books retain
  // six calendar labels so the chart frame is useful before the first posting.
  const earliest = periodEntries.reduce((first, entry) => entry.date < first ? entry.date : first, asOf)
  const chartFrom = from || (periodEntries.length ? earliest : monthStart(monthIndex(asOf) - 5))
  const firstMonth = monthIndex(chartFrom), lastMonth = monthIndex(asOf)
  const bucketMonths = Math.max(1, Math.ceil((lastMonth - firstMonth + 1) / 6))
  const bucketCount = Math.max(1, Math.ceil((lastMonth - firstMonth + 1) / bucketMonths))
  const crossYear = chartFrom.slice(0, 4) !== asOf.slice(0, 4)
  const buckets: OverviewBucket[] = Array.from({ length: bucketCount }, (_, index) => {
    const start = firstMonth + index * bucketMonths
    const end = Math.min(start + bucketMonths - 1, lastMonth)
    return {
      key: monthStart(start),
      label: start === end ? monthLabel(start, crossYear) : `${monthLabel(start, crossYear)}–${monthLabel(end, crossYear)}`,
      from: index === 0 ? chartFrom : monthStart(start),
      to: end === lastMonth ? asOf : addOverviewDays(monthStart(end + 1), -1),
      income: 0,
      expenses: 0,
    }
  })
  let hasIncomeExpenseActivity = false
  for (const entry of periodEntries) {
    const bucket = buckets[Math.floor((monthIndex(entry.date) - firstMonth) / bucketMonths)]
    if (!bucket) continue
    for (const line of entry.lines) {
      const type = accountTypes.get(line.account)
      if (type === 'Revenue') { bucket.income += line.credit - line.debit; hasIncomeExpenseActivity = true }
      if (type === 'Expense') { bucket.expenses += line.debit - line.credit; hasIncomeExpenseActivity = true }
    }
  }
  const income = buckets.reduce((sum, bucket) => sum + bucket.income, 0)
  const expenses = buckets.reduce((sum, bucket) => sum + bucket.expenses, 0)
  return {
    cash: allBalances.filter(account => account.cash).reduce((sum, account) => sum + account.net, 0),
    receivable: openInvoices.filter(invoice => invoice.kind === 'receivable').reduce((sum, invoice) => sum + invoice.open, 0),
    payable: openInvoices.filter(invoice => invoice.kind === 'payable').reduce((sum, invoice) => sum + invoice.open, 0),
    income, expenses, profit: income - expenses,
    trialDifference: allBalances.reduce((sum, account) => sum + account.net, 0),
    overdue, dueSoon, dueThrough, buckets, bucketMonths, chartFrom, hasIncomeExpenseActivity,
    recent: [...periodEntries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0, 5).map(entry => ({
      ...entry, amount: entry.lines.reduce((sum, line) => sum + line.debit, 0), status: overviewEntryStatus(books, entry, asOf),
    })),
  }
}
