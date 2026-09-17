import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canEditTask, filterComplianceTasks, filterRegulations, isOverdueTask, type RegulationRow, type TaskRow } from '../src/components/accounting/ComplianceWorkspace.helpers.ts'
const task = (id: string, changes: Partial<TaskRow> = {}): TaskRow => ({ id, version: 1, createdBy: 'author', createdAt: '', updatedAt: '', title: id, agency: 'BIR', period: '2026 Q3', sourceUrl: '', assignedTo: 'accountant', dueDate: '2026-09-20', status: 'needs_review', notes: '', filingDate: '', filingReference: '', evidenceUrl: '', attachments: [], ...changes })
test('accountants edit only their open tasks; reviewed tasks need a manager', () => {
  assert.equal(canEditTask('accountant', 'accountant', task('a')), true)
  assert.equal(canEditTask('accountant', 'other', task('a')), false)
  assert.equal(canEditTask('accountant', 'author', task('a', { assignedTo: '' })), true)
  assert.equal(canEditTask('accountant', 'other', task('a', { assignedTo: '' })), false)
  for (const status of ['filed', 'not_applicable'] as const) {
    assert.equal(canEditTask('accountant', 'accountant', task('a', { status })), false)
    assert.equal(canEditTask('manager', 'other', task('a', { status })), true)
  }
  assert.equal(canEditTask('viewer', 'accountant', task('a')), false)
})
test('due dates flag open obligations only, with no automatic status change', () => {
  const open = task('open', { dueDate: '2026-09-16' })
  assert.equal(isOverdueTask(open, '2026-09-17'), true)
  assert.equal(open.status, 'needs_review')
  assert.equal(isOverdueTask(task('today', { dueDate: '2026-09-17' }), '2026-09-17'), false)
  assert.equal(isOverdueTask(task('undated', { dueDate: '' }), '2026-09-17'), false)
  assert.equal(isOverdueTask(task('filed', { dueDate: '2026-09-16', status: 'filed' }), '2026-09-17'), false)
})
test('task filters combine owner, agency, status and text while retaining undated records', () => {
  const rows = [task('VAT', { notes: 'Quarterly reconciliation', dueDate: '2026-09-16' }), task('AFS', { agency: 'SEC', assignedTo: '' }), task('Payroll', { dueDate: '' }), task('Completed', { status: 'filed', dueDate: '2025-01-01' })]
  assert.deepEqual(filterComplianceTasks(rows, 'quarterLY', 'BIR', 'overdue', 'accountant', '2026-09-17').map(row => row.id), ['VAT'])
  assert.deepEqual(filterComplianceTasks(rows, '', '', '', '__unassigned', '2026-09-17').map(row => row.id), ['AFS'])
  assert.deepEqual(filterComplianceTasks(rows, '', '', '', '', '2026-09-17').map(row => row.id), ['VAT', 'AFS', 'Payroll', 'Completed'])
  assert.equal(rows[0].id, 'VAT')
})
test('library filters include amendment references and sort recent issuances first', () => {
  const record = (id: string, year: string, amends = ''): RegulationRow => ({ id, version: 1, createdBy: 'admin', createdAt: '', updatedAt: '', title: id, agency: 'BIR', number: id, year, kind: 'Revenue Regulations', url: 'https://www.bir.gov.ph/', issuedOn: '', effectiveOn: '', reviewedOn: '', amends, notes: '', attachments: [] })
  const rows = [record('RR 7-2024', '2024'), record('RR 26-2025', '2025', 'RR 11-2025')]
  assert.deepEqual(filterRegulations(rows, '11-2025', 'BIR', 'Revenue Regulations').map(row => row.id), ['RR 26-2025'])
  assert.deepEqual(filterRegulations(rows, '', '', '').map(row => row.id), ['RR 26-2025', 'RR 7-2024'])
  assert.equal(rows[0].id, 'RR 7-2024')
})
