import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addAccount, addInvoice, balances, cents, closePeriod, emptyBooks, outstanding, parseBooks, post, reverse, settle } from '../src/lib/accounting.ts'

const opening = () => post(emptyBooks(), { date: '2026-01-01', reference: 'OPEN-1', description: 'Opening capital', source: 'journal', lines: [{ account: '1010', debit: 100000, credit: 0 }, { account: '3000', debit: 0, credit: 100000 }] })
test('cent precision and invalid money', () => {
  assert.equal(cents('0.29'), 29)
  for (const value of ['-1', '1.001', 'NaN', 'Infinity', '1e4', '0']) assert.throws(() => cents(value))
})
test('journals reject unbalanced, double-sided, duplicate, and control account lines', () => {
  const b = opening(), e = b.entries[0]
  assert.throws(() => post(b, { ...e, reference: 'OTHER', lines: [{ account: '1010', debit: 3, credit: 0 }, { account: '3000', debit: 0, credit: 2 }] }))
  assert.throws(() => post(b, { ...e, reference: 'OTHER', lines: [{ account: '1010', debit: 1, credit: 1 }, { account: '3000', debit: 1, credit: 1 }] }))
  assert.throws(() => post(b, { ...e, reference: 'open-1' }))
  assert.throws(() => post(b, { ...e, reference: 'OTHER', lines: [{ account: '1100', debit: 100000, credit: 0 }, e.lines[1]] }))
})
test('bill, partial payment and invoice receipt reconcile subledgers, cash and reports', () => {
  let b = addInvoice(opening(), { kind: 'payable', party: 'Supplier', reference: 'B1', date: '2026-01-02', due: '2026-01-31', amount: 30000, account: '5100' })
  const bill = b.invoices[0]
  b = settle(b, bill.id, 10000, '2026-01-03', '1010', 'PAY-1')
  assert.equal(outstanding(b, bill), 20000)
  assert.equal(outstanding(b, bill, '2026-01-02'), 30000)
  assert.throws(() => settle(b, bill.id, 20001, '2026-01-03', '1010', 'PAY-X'))
  assert.throws(() => settle(b, bill.id, 100, '2026-01-01', '1010', 'PAY-X'))
  b = addInvoice(b, { kind: 'receivable', party: 'Customer', reference: 'I1', date: '2026-01-02', due: '2026-01-31', amount: 50000, account: '4100' })
  b = settle(b, b.invoices[1].id, 50000, '2026-01-04', '1010', 'REC-1')
  const rows = balances(b)
  assert.equal(rows.find(a => a.code === '1010')!.net, 140000)
  assert.equal(rows.find(a => a.code === '2000')!.net, -20000)
  assert.equal(rows.find(a => a.code === '1100')!.net, 0)
  assert.equal(rows.reduce((s, a) => s + a.net, 0), 0)
  assert.equal(-rows.filter(a => ['Revenue', 'Expense'].includes(a.type)).reduce((s, a) => s + a.net, 0), 20000)
  assert.deepEqual(parseBooks(JSON.stringify(closePeriod(b, '2026-01-31'))), closePeriod(b, '2026-01-31'))
})
test('reversals preserve original entry and respect locks', () => {
  const b = opening(), id = b.entries[0].id
  const next = reverse(b, id, '2026-02-01')
  assert.equal(next.entries.length, 2)
  assert.ok(balances(next).every(a => a.net === 0))
  assert.throws(() => reverse(next, id, '2026-02-02'))
  assert.throws(() => reverse(closePeriod(b, '2026-01-31'), id, '2026-01-15'))
  assert.throws(() => reverse(b, id, '2025-12-31'))
  assert.deepEqual(parseBooks(JSON.stringify(next)), next)
})
test('backup rejects corrupted links and duplicate ids', () => {
  const b = opening()
  assert.throws(() => parseBooks(JSON.stringify({ ...b, entries: [...b.entries, b.entries[0]] })))
  const invoice = addInvoice(b, { kind: 'receivable', party: 'Customer', reference: 'I1', date: '2026-01-02', due: '2026-01-31', amount: 1000, account: '4100' })
  assert.throws(() => parseBooks(JSON.stringify({ ...invoice, invoices: [] })))
  assert.throws(() => parseBooks(JSON.stringify({ ...invoice, invoices: [{ ...invoice.invoices[0], amount: 2000 }] })))
})
test('new accounts validate codes and cash types', () => {
  assert.throws(() => addAccount(emptyBooks(), { code: '1000', name: 'Duplicate', type: 'Asset', cash: true }))
  assert.throws(() => addAccount(emptyBooks(), { code: '6000', name: 'Wrong cash', type: 'Expense', cash: true }))
  const b = addAccount(emptyBooks(), { code: '1020', name: 'Petty cash', type: 'Asset', cash: true })
  assert.equal(b.accounts.find(a => a.code === '1020')?.cash, true)
})
test('payment and invoice corrections preserve subledger balances and restore correctly', () => {
  let b = addInvoice(opening(), { kind: 'payable', party: 'Supplier', reference: 'B1', date: '2026-01-02', due: '2026-01-31', amount: 30000, account: '5100' })
  const bill = b.invoices[0]
  b = settle(b, bill.id, 10000, '2026-01-03', '1010', 'PAY-1')
  assert.throws(() => reverse(b, bill.entryId, '2026-01-04'))
  b = reverse(b, b.settlements[0].entryId, '2026-01-04')
  assert.equal(outstanding(b, bill), 30000)
  assert.equal(outstanding(b, bill, '2026-01-03'), 20000)
  assert.throws(() => settle(b, bill.id, 30000, '2026-01-03', '1010', 'PAY-2'))
  b = reverse(b, bill.entryId, '2026-01-05')
  assert.equal(outstanding(b, bill), 0)
  assert.equal(balances(b).find(a => a.code === '2000')!.net, 0)
  assert.equal(balances(b).find(a => a.code === '1010')!.net, 100000)
  assert.deepEqual(parseBooks(JSON.stringify(b)), b)
  assert.throws(() => settle(b, bill.id, 100, '2026-01-06', '1010', 'PAY-2'))
})
