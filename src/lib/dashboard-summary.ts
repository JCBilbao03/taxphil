export type DashboardPeriod = 'month' | 'quarter' | 'year' | 'all'
type Item = { amount: number; date: string }
type Due = { dueDate: string; status: string }

export function dashboardSummary(income: Item[], expenses: Item[], deadlines: Due[], period: DashboardPeriod, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isFinite(Date.parse(today))) throw new Error('A valid reporting date is required.')
  const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7))
  const firstMonth = period === 'quarter' ? Math.floor((month - 1) / 3) * 3 + 1 : period === 'month' ? month : 1
  const from = period === 'all' ? '0000-01-01' : `${year}-${String(firstMonth).padStart(2, '0')}-01`
  const to = today
  const sum = (items: Item[]) => items.filter((item) => item.date >= from && item.date <= to).reduce((total, item) => total + Math.round(item.amount * 100), 0)
  const incomeCentavos = sum(income), expenseCentavos = sum(expenses)
  const quarterStart = `${year}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, '0')}-01`
  const quarterEnd = new Date(Date.UTC(year, Math.floor((month - 1) / 3) * 3 + 3, 0)).toISOString().slice(0, 10)
  const pending = deadlines.filter((item) => item.status !== 'filed')
  return { from, to, income: incomeCentavos / 100, expenses: expenseCentavos / 100, net: (incomeCentavos - expenseCentavos) / 100,
    overdue: pending.filter((item) => item.dueDate < today).length,
    dueThisQuarter: pending.filter((item) => item.dueDate >= quarterStart && item.dueDate <= quarterEnd).length,
    totalPending: pending.length,
  }
}
