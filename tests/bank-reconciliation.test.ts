import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bankLedgerLines, excludeClearedOpeningLines, findBankDuplicateCandidates, suggestBankMatches, validateBankAccount, validateBankMatch, validateStatementBalances, validateStatementRows, type BankBookLine, type BankStatementRow } from '../src/lib/bank-reconciliation.ts'

const row = (id: string, amount: number, date = '2026-09-01'): BankStatementRow => ({ id, amount, date, description: 'Bank movement', reference: 'REF-001', balance: null, source: { format: 'csv', fileName: 'statement.csv', row: 2 }, issues: [], raw: { amount: String(amount / 100) } })
const line = (id: string, amount: number, date = '2026-09-01'): BankBookLine => ({ id: `${id}:1`, entryId: id, lineIndex: 1, amount, date, reference: 'REF-001', description: 'Bank movement', source: 'receipt' })

test('frontend and server reconciliation engines remain identical', () => {
  assert.equal(readFileSync(new URL('../src/lib/bank-reconciliation.ts', import.meta.url), 'utf8'), readFileSync(new URL('../functions/src/bank-reconciliation.ts', import.meta.url), 'utf8'))
})
test('bank account accepts only PHP bank/cash asset links', () => {
  const account = { id: 'bank-1', name: 'Operating account', bankName: 'Sample bank', accountSuffix: '1234', accountCode: '1010', currency: 'PHP', active: true }
  const chart = [{ code: '1010', type: 'Asset', cash: true }]
  assert.equal(validateBankAccount(account, chart).accountCode, '1010')
  assert.throws(() => validateBankAccount({ ...account, currency: 'USD' }, chart), /PHP/)
  assert.throws(() => validateBankAccount(account, [{ ...chart[0], cash: false }]), /asset/)
})
test('draft row validation retains unresolved source values; strict validation blocks them', () => {
  const draft = { ...row('a', 100), date: null, amount: null, issues: [{ code: 'ambiguous_date', message: 'Review date' }] }
  assert.equal(validateStatementRows([draft], { allowUnresolved: true })[0].raw.amount, '1')
  assert.throws(() => validateStatementRows([draft]), /Resolve/)
  assert.throws(() => validateStatementRows([row('a', 100), row('a', 100)]), /unique/)
})
test('statement balance validation checks running balances, totals and period', () => {
  const rows = [{ ...row('a', 10000), balance: 110000 }, { ...row('b', -500, '2026-09-02'), balance: 109500 }]
  assert.equal(validateStatementBalances({ rows, openingBalance: 100000, closingBalance: 109500, from: '2026-09-01', to: '2026-09-30' }).valid, true)
  const bad = validateStatementBalances({ rows: [{ ...rows[0], balance: 111000 }, rows[1]], openingBalance: 100000, closingBalance: 110000, from: '2026-09-02', to: '2026-09-30' })
  assert.deepEqual(new Set(bad.issues.map(issue => issue.code)), new Set(['outside_period', 'running_balance_mismatch', 'closing_balance_mismatch']))
})
test('descending statements reconcile in chronological order without changing original row order', () => {
  const rows = [{ ...row('b', -500, '2026-09-02'), balance: 109500 }, { ...row('a', 10000), balance: 110000 }]
  assert.equal(validateStatementBalances({ rows, openingBalance: 100000, closingBalance: 109500, order: 'descending' }).valid, true)
  assert.equal(rows[0].id, 'b')
})
test('missing amounts prevent closing-balance approval without inventing a total', () => {
  const result = validateStatementBalances({ rows: [{ ...row('a', 100), amount: null }], openingBalance: 10000, closingBalance: 10000 })
  assert.equal(result.valid, false)
  assert.equal(result.movement, null)
  assert.equal(result.calculatedClosingBalance, null)
})
test('bank ledger identities include line index and retain original and reversal movement', () => {
  const books = { accounts: [{ code: '1010', type: 'Asset', cash: true }], entries: [
    { id: 'original', date: '2026-09-01', reference: 'R1', description: 'Receipt', source: 'receipt', lines: [{ account: '1010', debit: 10000, credit: 0 }, { account: '1100', debit: 0, credit: 10000 }] },
    { id: 'reversal', date: '2026-09-02', reference: 'REV-R1', description: 'Reversed', source: 'reversal', lines: [{ account: '1010', debit: 0, credit: 10000 }, { account: '1100', debit: 10000, credit: 0 }] },
  ] }
  const lines = bankLedgerLines(books, '1010')
  assert.deepEqual(lines.map(item => [item.id, item.amount]), [['original:0', 10000], ['reversal:0', -10000]])
  assert.equal(bankLedgerLines(books, '1010', '2026-09-01').length, 1)
})
test('duplicate detection flags candidates without collapsing legitimate identical transactions', () => {
  const rows = [row('new-a', 10000), row('new-b', 10000)]
  const candidates = findBankDuplicateCandidates(rows, [row('previous', 10000)])
  assert.equal(rows.length, 2)
  assert.deepEqual(candidates[1].existingRowIds, ['previous', 'new-a'])
  assert.equal(findBankDuplicateCandidates([row('different', -10000)], rows).length, 0)
})
test('one-to-one matching consumes exact centavos without changing books or bank rows', () => {
  const bankRows = [row('bank', 10000)], bookLines = [line('ledger', 10000)]
  const before = JSON.stringify({ bankRows, bookLines })
  const result = validateBankMatch({ bankRows, bookLines, allocations: [{ bankRowId: 'bank', bookLineId: 'ledger:1', amount: 10000 }] })
  assert.deepEqual(result.matchedBankRowIds, ['bank'])
  assert.deepEqual(result.matchedBookLineIds, ['ledger:1'])
  assert.equal(JSON.stringify({ bankRows, bookLines }), before)
})
test('group deposits and split payments conserve the available amounts', () => {
  const grouped = validateBankMatch({ bankRows: [row('bank', 10000)], bookLines: [line('one', 6000), line('two', 4000)], allocations: [
    { bankRowId: 'bank', bookLineId: 'one:1', amount: 6000 }, { bankRowId: 'bank', bookLineId: 'two:1', amount: 4000 },
  ] })
  assert.equal(grouped.bankRemaining.bank, 0)
  const split = validateBankMatch({ bankRows: [row('a', -6000), row('b', -4000)], bookLines: [line('pay', -10000)], allocations: [
    { bankRowId: 'a', bookLineId: 'pay:1', amount: 6000 }, { bankRowId: 'b', bookLineId: 'pay:1', amount: 4000 },
  ] })
  assert.equal(split.bookRemaining['pay:1'], 0)
})
test('net deposits can group receipt and separately posted fee lines', () => {
  const result = validateBankMatch({ bankRows: [row('bank', 9700)], bookLines: [line('receipt', 10000), line('fee', -300)], allocations: [
    { bankRowId: 'bank', bookLineId: 'receipt:1', amount: 10000 }, { bankRowId: 'bank', bookLineId: 'fee:1', amount: 300 },
  ] })
  assert.equal(result.bankRemaining.bank, 0)
  assert.equal(result.matchedBookLineIds.length, 2)
})
test('existing allocations prevent overuse, duplicate edges and opposite-direction matches', () => {
  const base = { bankRows: [row('a', 6000), row('b', 6000)], bookLines: [line('receipt', 10000)], existingAllocations: [{ bankRowId: 'a', bookLineId: 'receipt:1', amount: 6000 }] }
  assert.throws(() => validateBankMatch({ ...base, allocations: [{ bankRowId: 'b', bookLineId: 'receipt:1', amount: 6000 }] }), /more than/)
  assert.throws(() => validateBankMatch({ ...base, allocations: [{ bankRowId: 'a', bookLineId: 'receipt:1', amount: 1 }] }), /already linked/)
  assert.throws(() => validateBankMatch({ bankRows: [row('a', -100)], bookLines: [line('r', 100)], allocations: [{ bankRowId: 'a', bookLineId: 'r:1', amount: 100 }] }), /opposite/)
})
test('suggestions rank amount/reference/date but preserve ambiguous options for review', () => {
  const suggestions = suggestBankMatches(row('bank', 10000), [line('a', 10000), line('b', 10000), line('wrong', -10000)])
  assert.equal(suggestions.length, 2)
  assert.equal(suggestions[0].score, suggestions[1].score)
  assert.equal(suggestions[0].exactAmount, true)
  assert.deepEqual(suggestBankMatches({ ...row('bank', 10000), amount: null }, [line('a', 10000)]), [])
})

test('matching omits already-cleared opening lines and carries the first approved baseline forward', () => {
  const opening = line('opening', 100000, '2026-08-01'), oldCheck = line('old-check', -1000, '2026-08-20'), current = line('current', 1000, '2026-09-10')
  const lines = [opening, oldCheck, current], first = { bankId: 'bank', from: '2026-09-01', status: 'draft', openingOutstandingLineIds: [] as string[] }
  assert.deepEqual(excludeClearedOpeningLines(lines, first, []).map(row => row.id), [current.id])
  first.openingOutstandingLineIds = [oldCheck.id]
  assert.deepEqual(excludeClearedOpeningLines(lines, first, []).map(row => row.id), [oldCheck.id, current.id])
  const later = { bankId: 'bank', from: '2026-10-01', status: 'draft', openingOutstandingLineIds: [] }
  const otherBank = { ...first, bankId: 'other', from: '2026-01-01', status: 'approved' }
  assert.deepEqual(excludeClearedOpeningLines(lines, later, [otherBank, { ...first, status: 'approved' }, later]).map(row => row.id), [oldCheck.id, current.id])
  assert.deepEqual(excludeClearedOpeningLines(lines, { ...first, openingOutstandingLineIds: [] }, [{ ...first, status: 'draft' }]).map(row => row.id), [current.id])
})
