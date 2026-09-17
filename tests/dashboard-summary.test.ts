import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dashboardSummary } from '../src/lib/dashboard-summary.ts'

test('dashboard quarter-to-date excludes older and future-dated records and keeps centavos exact', () => {
  const summary = dashboardSummary([{ amount: 100, date: '2026-06-30' }, { amount: 0.1, date: '2026-07-01' }, { amount: 0.2, date: '2026-09-17' }, { amount: 1000, date: '2026-09-18' }], [{ amount: 0.05, date: '2026-08-01' }], [], 'quarter', '2026-09-17')
  assert.equal(summary.from, '2026-07-01'); assert.equal(summary.income, 0.3); assert.equal(summary.expenses, 0.05); assert.equal(summary.net, 0.25)
})

test('month, year and all-time metrics apply their displayed date boundaries', () => {
  const items = [{ amount: 1, date: '2025-12-31' }, { amount: 2, date: '2026-01-01' }, { amount: 3, date: '2026-09-01' }, { amount: 4, date: '2026-12-31' }]
  assert.equal(dashboardSummary(items, [], [], 'month', '2026-09-17').income, 3)
  assert.equal(dashboardSummary(items, [], [], 'year', '2026-09-17').income, 5)
  assert.equal(dashboardSummary(items, [], [], 'all', '2026-09-17').income, 6)
})

test('overdue, this-quarter and total pending obligations have distinct counts', () => {
  const dues = [{ dueDate: '2026-06-30', status: 'upcoming' }, { dueDate: '2026-09-16', status: 'upcoming' }, { dueDate: '2026-09-30', status: 'upcoming' }, { dueDate: '2026-10-01', status: 'upcoming' }, { dueDate: '2026-09-15', status: 'filed' }]
  const result = dashboardSummary([], [], dues, 'quarter', '2026-09-17')
  assert.equal(result.overdue, 2); assert.equal(result.dueThisQuarter, 2); assert.equal(result.totalPending, 4)
})
