import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addInvoice, emptyBooks, post, reverse, settle, type Books, type Invoice } from '../src/lib/accounting.ts'
import { accountingOverview, overviewEntryStatus } from '../src/lib/accounting-overview.ts'

function invoice(books: Books, reference: string, kind: Invoice['kind'], date: string, due: string, amount = 10000) {
  return addInvoice(books, { kind, reference, party: `Party ${reference}`, date, due, amount, account: kind === 'receivable' ? '4100' : '5100' })
}

test('empty books keep actual zero totals and six dated chart buckets', () => {
  const view = accountingOverview(emptyBooks(), '', '2026-09-17')
  assert.deepEqual([view.cash, view.receivable, view.payable, view.profit, view.income, view.expenses, view.trialDifference], [0, 0, 0, 0, 0, 0, 0])
  assert.deepEqual(view.buckets.map(bucket => bucket.label), ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'])
  assert.ok(view.buckets.every(bucket => bucket.income === 0 && bucket.expenses === 0))
  assert.equal(view.hasIncomeExpenseActivity, false)
  assert.deepEqual([view.overdue.length, view.dueSoon.length, view.recent.length], [0, 0, 0])
})

test('income and expenses include signed reversals in their posting period', () => {
  let books = invoice(emptyBooks(), 'INV-1', 'receivable', '2026-01-05', '2026-01-30', 25000)
  const sale = books.entries.at(-1)!
  books = invoice(books, 'BILL-1', 'payable', '2026-01-06', '2026-01-30', 8000)
  const bill = books.entries.at(-1)!
  books = reverse(books, sale.id, '2026-02-04')
  books = reverse(books, bill.id, '2026-02-05')
  const view = accountingOverview(books, '2026-01-01', '2026-02-28')
  assert.deepEqual(view.buckets.map(bucket => [bucket.income, bucket.expenses]), [[25000, 8000], [-25000, -8000]])
  assert.deepEqual([view.income, view.expenses, view.profit], [0, 0, 0])
  const reversalsOnly = accountingOverview(books, '2026-02-01', '2026-02-28')
  assert.deepEqual([reversalsOnly.income, reversalsOnly.expenses, reversalsOnly.profit], [-25000, -8000, -17000])
  assert.equal(view.hasIncomeExpenseActivity, true)
})

test('balances use the as-of date while profit and recent entries use the period', () => {
  let books = post(emptyBooks(), { date: '2026-01-01', reference: 'CAPITAL', description: 'Opening capital', source: 'journal', lines: [{ account: '1010', debit: 100000, credit: 0 }, { account: '3000', debit: 0, credit: 100000 }] })
  books = invoice(books, 'INV-OLD', 'receivable', '2026-01-10', '2026-01-20', 50000)
  const customerInvoice = books.invoices.at(-1)!
  books = settle(books, customerInvoice.id, 20000, '2026-02-05', '1010', 'RECEIPT')
  books = invoice(books, 'BILL-NEW', 'payable', '2026-02-08', '2026-03-01', 9000)
  books = settle(books, customerInvoice.id, 30000, '2026-03-05', '1010', 'FUTURE-RECEIPT')
  books = invoice(books, 'INV-FUTURE', 'receivable', '2026-03-01', '2026-03-05', 70000)
  const view = accountingOverview(books, '2026-02-01', '2026-02-28')
  assert.deepEqual([view.cash, view.receivable, view.payable, view.income, view.expenses, view.profit], [120000, 30000, 9000, 0, 9000, -9000])
  assert.deepEqual(view.recent.map(entry => entry.reference), ['AP-BILL-NEW', 'RECEIPT'])
  assert.equal(view.overdue[0]?.open, 30000)
})

test('attention excludes settled, reversed and future documents; seven days includes today', () => {
  let books = emptyBooks()
  for (const [reference, date, due] of [
    ['TODAY', '2026-02-20', '2026-02-28'], ['DAY-7', '2026-02-20', '2026-03-06'], ['DAY-8', '2026-02-20', '2026-03-07'],
    ['PAST', '2026-02-20', '2026-02-27'], ['FUTURE', '2026-03-01', '2026-03-03'], ['VOID', '2026-02-20', '2026-03-01'], ['PAID', '2026-02-20', '2026-03-01'],
  ]) books = invoice(books, reference, 'payable', date, due)
  books = reverse(books, books.invoices.find(item => item.reference === 'VOID')!.entryId, '2026-02-25')
  books = settle(books, books.invoices.find(item => item.reference === 'PAID')!.id, 10000, '2026-02-26', '1010', 'PAYMENT')
  books = invoice(books, 'OVERDUE', 'receivable', '2026-02-20', '2026-02-27')
  books = invoice(books, 'DUE-TODAY', 'receivable', '2026-02-20', '2026-02-28')
  const view = accountingOverview(books, '', '2026-02-28')
  assert.equal(view.dueThrough, '2026-03-06')
  assert.deepEqual(view.dueSoon.map(item => item.reference), ['TODAY', 'DAY-7'])
  assert.deepEqual(view.overdue.map(item => item.reference), ['OVERDUE'])
})

test('invoice and settlement statuses respect payment and reversal dates', () => {
  let books = invoice(emptyBooks(), 'INV-1', 'receivable', '2026-02-01', '2026-02-28')
  const customerInvoice = books.invoices[0], entry = books.entries[0]
  books = settle(books, customerInvoice.id, 4000, '2026-02-05', '1010', 'PARTIAL')
  const partial = books.entries.at(-1)!
  books = settle(books, customerInvoice.id, 6000, '2026-02-06', '1010', 'FINAL')
  books = reverse(books, partial.id, '2026-03-01')
  assert.equal(overviewEntryStatus(books, entry, '2026-02-01'), 'Unpaid')
  assert.equal(overviewEntryStatus(books, entry, '2026-02-05'), 'Part-paid')
  assert.equal(overviewEntryStatus(books, entry, '2026-02-28'), 'Paid')
  assert.equal(overviewEntryStatus(books, entry, '2026-03-01'), 'Overdue')
  assert.equal(overviewEntryStatus(books, partial, '2026-02-28'), 'Recorded')
  assert.equal(overviewEntryStatus(books, partial, '2026-03-01'), 'Reversed')
  assert.equal(overviewEntryStatus(books, books.entries.at(-1)!, '2026-03-01'), 'Reversal posted')
})

test('long chart ranges stay bounded and preserve exact period totals', () => {
  let books = invoice(emptyBooks(), 'OLD', 'receivable', '2024-01-15', '2024-02-15', 12345)
  books = invoice(books, 'NEW', 'receivable', '2026-09-15', '2026-10-15', 67890)
  const view = accountingOverview(books, '', '2026-09-17')
  assert.ok(view.buckets.length <= 6)
  assert.equal(view.income, 80235)
  assert.equal(view.buckets[0].from, '2024-01-15')
  assert.equal(view.buckets.at(-1)!.to, '2026-09-17')
})
