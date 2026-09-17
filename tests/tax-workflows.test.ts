import { test } from 'node:test'
import assert from 'node:assert/strict'
import { todayManila, validTrackingDate, trackingDateLabel, daysToDeadline, deadlineStatus, parsePesoAmount, normalizeTransaction, normalizeDeadline, normalizeFilingEvidence, safeTrackingUrl, filterTransactions, transactionTotals, trackingCsv } from '../src/lib/tax-workflows.ts'

test('calendar dates follow Manila midnight without browser timezone or DST drift', () => {
  assert.equal(todayManila(new Date('2026-09-16T15:59:59Z')), '2026-09-16')
  assert.equal(todayManila(new Date('2026-09-16T16:00:00Z')), '2026-09-17')
  assert.equal(daysToDeadline('2026-03-09', '2026-03-08'), 1)
  assert.equal(daysToDeadline('2026-09-17', '2026-09-17'), 0)
  assert.ok(Number.isNaN(daysToDeadline('invalid')))
})
test('invalid dates and non-leap February 29 do not normalize silently', () => {
  assert.equal(validTrackingDate('2024-02-29'), true)
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '', '09/17/2026', '2026-9-17']) assert.equal(validTrackingDate(date), false)
  assert.equal(trackingDateLabel('bad'), 'Date needs review')
})
test('open deadline status derives from its current date rather than stale saved urgency', () => {
  assert.equal(deadlineStatus({ status: 'overdue', dueDate: '2026-10-31' }, '2026-09-17'), 'upcoming')
  assert.equal(deadlineStatus({ status: 'upcoming', dueDate: '2026-09-16' }, '2026-09-17'), 'overdue')
  assert.equal(deadlineStatus({ status: 'upcoming', dueDate: '2026-10-01' }, '2026-09-17'), 'due_soon')
  assert.equal(deadlineStatus({ status: 'filed', dueDate: '2025-01-01' }, '2026-09-17'), 'filed')
  assert.equal(deadlineStatus({ status: 'upcoming', dueDate: 'bad' }), 'review')
})
test('peso inputs retain centavos and reject ambiguous, negative or excessive precision', () => {
  assert.equal(parsePesoAmount('0.29'), 0.29)
  assert.equal(parsePesoAmount('100.1'), 100.1)
  assert.equal(parsePesoAmount('0', true), 0)
  for (const amount of ['0', '-1', '1.001', '1e3', '3oops', '1,000', 'Infinity', '10000000000.01']) assert.throws(() => parsePesoAmount(amount))
  assert.deepEqual(transactionTotals([{ type: 'income', amount: .1 }, { type: 'income', amount: .2 }, { type: 'expense', amount: .29 }]), { income: .3, expenses: .29, net: .01 })
})
test('transaction input trims text, omits undefined writes and rejects invalid fields', () => {
  const input = { type: 'income' as const, description: ' Fee ', amount: 0.29, date: '2026-09-17', category: '' }
  assert.deepEqual(normalizeTransaction(input), { ...input, description: 'Fee', category: 'Uncategorized', reference: '' })
  assert.throws(() => normalizeTransaction({ ...input, description: ' ' }))
  assert.throws(() => normalizeTransaction({ ...input, date: '2026-02-29' }))
  assert.throws(() => normalizeTransaction({ ...input, amount: 1.001 }))
})
test('filter boundaries are inclusive, combine search and type, and preserve original data', () => {
  const records = [
    { type: 'income' as const, description: 'Client fee', amount: 100, date: '2026-09-01', category: 'Services', reference: 'INV1' },
    { type: 'expense' as const, description: 'Office fee', amount: 30, date: '2026-09-30', category: 'Office' },
    { type: 'income' as const, description: 'Other', amount: 50, date: '2026-10-01', category: 'Services' },
  ]
  const copy = structuredClone(records)
  assert.equal(filterTransactions(records, { from: '2026-09-01', to: '2026-09-30' }).length, 2)
  assert.deepEqual(filterTransactions(records, { type: 'income', query: 'inv1' }), [records[0]])
  assert.deepEqual(records, copy)
})
test('manual deadlines require real dates, permit no-payment amounts, and never infer filing', () => {
  const result = normalizeDeadline({ formType: '1702-RT', title: 'Annual return', dueDate: '2026-04-15', amountDue: 0 })
  assert.equal(result.amountDue, 0)
  assert.equal('status' in result, false)
  assert.throws(() => normalizeDeadline({ ...result, dueDate: '' }))
  assert.throws(() => normalizeDeadline({ ...result, sourceUrl: 'javascript:alert(1)' }))
})
test('filing evidence requires an acknowledgement and a nonfuture Philippine date', () => {
  const input = { filingDate: '2026-09-17', filingReference: ' ACK-1 ', evidenceUrl: 'https://example.com/evidence' }
  assert.equal(normalizeFilingEvidence(input, '2026-09-17').filingReference, 'ACK-1')
  assert.throws(() => normalizeFilingEvidence({ ...input, filingReference: ' ' }, '2026-09-17'))
  assert.throws(() => normalizeFilingEvidence(input, '2026-09-16'))
  assert.throws(() => normalizeFilingEvidence({ ...input, filingDate: '2026-02-30' }, '2026-09-17'))
})
test('evidence links reject active schemes and credentials', () => {
  assert.equal(safeTrackingUrl(' https://example.com/proof '), 'https://example.com/proof')
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'https://user:password@example.com', '/relative']) assert.throws(() => safeTrackingUrl(url))
})
test('CSV exports escape commas and quotes and neutralize user-controlled formulas', () => {
  const csv = trackingCsv([['Date', 'Text', 'Amount'], ['2026-09-17', '=HYPERLINK("url")', 1.25], ['with,comma', '\n +SUM(1,2)', -1]])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"\'=HYPERLINK(""url"")"'))
  assert.ok(csv.includes('"with,comma"'))
  assert.ok(csv.includes('"\'\n +SUM(1,2)"'))
  assert.ok(csv.endsWith('"-1"'))
})
