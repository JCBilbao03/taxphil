import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AccountingWorkspace } from '../src/pages/AccountingPage'
import { AccountingShell } from '../src/components/accounting/AccountingShell'
import { CompanyContext, type CompanyContextValue, type CompanyRole } from '../src/hooks/useCompany'
import { CompanyRecordsPreview } from '../src/hooks/useCompanyRecords'
import { DEFAULT_COMPANY_PROFILE } from '../src/lib/ph-compliance'
import { emptyBooks, post } from '../src/lib/accounting'
import { bankLedgerLines, validateBankAccount, validateBankMatch, validateStatementRows, type BankStatementRow } from '../src/lib/bank-reconciliation'
import { type BankAccountRecord, type BankAdjustment, type BankStatement, type CompanyBankRequest } from '../src/lib/bank-workflow'
import sampleStatement from './fixtures/bank-statements/fictional-bank-statement.csv?raw'
import '../src/index.css'

if (!import.meta.env.DEV) throw Error('Development fixture only')
const stamp = '2026-09-05T01:00:00Z'
const bank: BankAccountRecord = { id: 'sample-bank', version: 1, name: 'Fictional operating account', bankName: 'Sample Bank', accountSuffix: '1234', accountCode: '1010', currency: 'PHP', active: true, createdBy: 'sample-admin', createdAt: stamp, updatedBy: 'sample-admin', updatedAt: stamp }
let draftBooks = post(emptyBooks(), { date: '2026-08-31', reference: 'DEMO-OPEN', description: 'Fictional opening bank balance', source: 'journal', lines: [{ account: '1010', debit: 1000000, credit: 0 }, { account: '3000', debit: 0, credit: 1000000 }] })
draftBooks = post(draftBooks, { date: '2026-09-01', reference: 'DEMO-RECEIPT', description: 'Fictional customer collection', source: 'receipt', lines: [{ account: '1010', debit: 500000, credit: 0 }, { account: '4000', debit: 0, credit: 500000 }] })
draftBooks = post(draftBooks, { date: '2026-09-02', reference: 'DEMO-PAYMENT', description: 'Fictional supplier payment', source: 'payment', lines: [{ account: '5900', debit: 100000, credit: 0 }, { account: '1010', debit: 0, credit: 100000 }] })
const reviewedBooks = post(draftBooks, { date: '2026-09-03', reference: 'DEMO-BANK-FEE', description: 'Fictional bank fee already posted for reviewed scenario', source: 'journal', lines: [{ account: '5900', debit: 5000, credit: 0 }, { account: '1010', debit: 0, credit: 5000 }] })
const rows: BankStatementRow[] = [
  { id: 'sample-statement-receipt', date: '2026-09-01', description: 'Fictional customer collection', reference: 'DEMO-RECEIPT', amount: 500000, balance: 1500000, source: { format: 'csv', fileName: 'fictional-bank-statement.csv', row: 4, text: '2026-09-01,Fictional customer collection,DEMO-RECEIPT,5000.00,,15000.00' }, raw: { date: '2026-09-01', credit: '5000.00', balance: '15000.00' }, issues: [] },
  { id: 'sample-statement-payment', date: '2026-09-02', description: 'Fictional supplier payment', reference: 'DEMO-PAYMENT', amount: -100000, balance: 1400000, source: { format: 'csv', fileName: 'fictional-bank-statement.csv', row: 5, text: '2026-09-02,Fictional supplier payment,DEMO-PAYMENT,,1000.00,14000.00' }, raw: { date: '2026-09-02', debit: '1000.00', balance: '14000.00' }, issues: [] },
  { id: 'sample-statement-fee', date: '2026-09-03', description: 'Fictional bank fee', reference: 'DEMO-BANK-FEE', amount: -5000, balance: 1395000, source: { format: 'csv', fileName: 'fictional-bank-statement.csv', row: 6, text: '2026-09-03,Fictional bank fee,DEMO-BANK-FEE,,50.00,13950.00' }, raw: { date: '2026-09-03', debit: '50.00', balance: '13950.00' }, issues: [] },
]
function seed(status: BankStatement['status']): BankStatement {
  const books = status === 'draft' ? draftBooks : reviewedBooks, lines = bankLedgerLines(books, bank.accountCode)
  return { id: 'sample-statement', bankId: bank.id, version: 1, status, reference: 'DEMO-SEP-2026', from: '2026-09-01', to: '2026-09-30', openingBalance: 1000000, closingBalance: 1395000, order: 'ascending', rows: structuredClone(rows), openingReviewed: true, openingOutstandingLineIds: [], allocations: status === 'draft' ? [] : rows.map(row => ({ bankRowId: row.id, bookLineId: lines.find(line => line.reference === row.reference)!.id, amount: Math.abs(row.amount!) })), importedRowIds: rows.map(row => row.id), file: { path: 'companies/isolated-bank/bank-statements/sample-statement', name: 'fictional-bank-statement.csv', size: 393, type: 'text/csv', sha256: 'a'.repeat(64) }, createdBy: 'sample-accountant', createdAt: stamp, updatedBy: 'sample-accountant', updatedAt: stamp,
    ...(status === 'draft' ? {} : { preparedBy: 'sample-accountant', preparedAt: stamp, preparedBooksRevision: 4, preparedBooksFingerprint: 'fictional-preview-fingerprint', report: { asOf: '2026-09-30', booksRevision: 4, booksFingerprint: 'fictional-preview-fingerprint', bankBalance: 1395000, bookBalance: 1395000, outstandingDeposits: 0, outstandingPayments: 0, adjustedBankBalance: 1395000, difference: 0, unmatchedBankRowIds: [], outstandingBookLines: [], openingBookBalance: 1000000, openingOutstandingAmount: 0, openingDifference: 0 } }),
    ...(status === 'approved' ? { approvedBy: 'sample-manager', approvedAt: stamp, reviewNote: 'Fictional independent review for display verification only.' } : {}) }
}
const sampleAdjustment: BankAdjustment = { id: 'sample-adjustment', statementId: 'sample-statement', bankRowId: 'sample-statement-fee', version: 1, status: 'pending', date: '2026-09-03', reference: 'DEMO-BANK-FEE', description: 'Fictional bank charge awaiting a different reviewer', offsetAccount: '5900', amount: -5000, createdBy: 'sample-accountant', createdAt: stamp }

function App() {
  const [role, setRole] = useState<CompanyRole>('admin'), [scenario, setScenario] = useState<BankStatement['status']>('draft'), [accounts, setAccounts] = useState([bank]), [statements, setStatements] = useState([seed('draft')]), [adjustments, setAdjustments] = useState([sampleAdjustment])
  const books = scenario === 'draft' ? draftBooks : reviewedBooks, membership = { uid: `sample-${role}`, email: `${role}@example.test`, displayName: `Sample ${role}`, companyId: 'isolated-bank', companyCode: 'PH-BANK-DEMO', role, active: true }
  const invoke: CompanyContextValue['invoke'] = async (name, data) => {
    if (name !== 'companyBank') throw Error('This isolated preview enables bank interface actions only.')
    if (role === 'viewer') throw Error('Bank statements are private to authorized accounting staff.')
    const request = data as CompanyBankRequest
    if (request.action === 'saveAccount') {
      if (!['admin', 'manager'].includes(role)) throw Error('An Admin or Manager must configure bank accounts.')
      const account = validateBankAccount({ ...request.value, id: crypto.randomUUID() }, books.accounts)
      if (accounts.some(row => row.accountCode === account.accountCode)) throw Error('Choose an unlinked bank ledger account.')
      setAccounts(old => [...old, { ...account, version: 1, createdBy: membership.uid, createdAt: stamp, updatedBy: membership.uid, updatedAt: stamp }]); return { id: account.id } as never
    }
    if (request.action === 'importStatement') {
      const note = (request as typeof request & { reviewNote?: string }).reviewNote || ''
      if (note.trim().length < 10) throw Error('Explain your review of imported rows and source values.')
      validateStatementRows(request.input.rows, { allowUnresolved: true })
      const prior = statements.find(row => row.bankId === request.bankId && row.file.sha256 === request.file.sha256)
      if (prior) return { id: prior.id, alreadyImported: true } as never
      const id = crypto.randomUUID(), importedRows = request.input.rows.map((row, index) => ({ ...row, id: `${id}-row-${index + 1}` }))
      const imported: BankStatement = { ...request.input, rows: importedRows, importedRowIds: importedRows.map(row => row.id), id, bankId: request.bankId, version: 1, status: 'draft', allocations: [], file: request.file, createdBy: membership.uid, createdAt: new Date().toISOString(), updatedBy: membership.uid, updatedAt: new Date().toISOString(), reviewNote: note }
      setStatements(old => [...old, imported]); return { id } as never
    }
    if (request.action === 'prepareAdjustment') throw Error('Preparing and posting adjustments is covered by backend tests; this fictional page shows their review controls only.')
    if (request.action === 'approveAdjustment' || request.action === 'rejectAdjustment') {
      if (!['admin', 'manager'].includes(role)) throw Error('An independent Admin or Manager must review adjustments.')
      const row = adjustments.find(row => row.id === request.id)
      if (!row || row.version !== request.expectedVersion) throw Error('Reload the adjustment preview.')
      if (request.action === 'approveAdjustment') throw Error('This fixture never simulates ledger posting. Real approval and atomic posting are verified separately by backend handler tests.')
      setAdjustments(old => old.map(value => value.id === row.id ? { ...value, status: 'rejected', version: value.version + 1, reviewNote: request.note } : value)); return { id: row.id } as never
    }
    const statement = statements.find(row => row.id === request.id)
    if (!statement || request.expectedVersion !== statement.version) throw Error('The preview changed. Close and reopen the dialog.')
    if (request.action === 'saveMatches') {
      validateBankMatch({ bankRows: statement.rows, bookLines: bankLedgerLines(books, bank.accountCode, statement.to), allocations: request.allocations })
      setStatements(old => old.map(row => row.id === statement.id ? { ...row, allocations: request.allocations, version: row.version + 1 } : row)); return { id: statement.id } as never
    }
    if (request.action === 'saveStatement') {
      validateStatementRows(request.input.rows, { allowUnresolved: true })
      if (statement.allocations.length) throw Error('Clear saved matches before changing rows.')
      if (request.reviewNote.trim().length < 10) throw Error('Explain the reviewed corrections.')
      setStatements(old => old.map(row => row.id === statement.id ? { ...row, ...request.input, version: row.version + 1 } : row)); return { id: statement.id } as never
    }
    throw Error('This isolated preview checks forms and review controls. Preparing, approving and reopening real reconciliations are tested separately against the backend handler. Choose a scenario above to inspect its appearance.')
  }
  const value: CompanyContextValue = { membership, company: { companyCode: membership.companyCode, profile: { ...DEFAULT_COMPANY_PROFILE, registeredName: 'Fictional Bank Preview Company' } }, books, revision: scenario === 'draft' ? 3 : 4, members: [], approvals: [], audit: [], loading: false, busy: false, error: '', booksReady: true, invoke, command: async () => { throw Error('This isolated preview never posts accounting entries.') } }
  return <CompanyContext.Provider value={value}><CompanyRecordsPreview.Provider value={{ bankAccounts: accounts, bankStatements: statements, bankAdjustments: adjustments, bankPreviewFiles: [{ name: 'fictional-bank-statement.csv', text: sampleStatement }] }}><div className="flex flex-wrap items-center gap-3 bg-amber-50 px-5 py-3 text-sm text-amber-900"><b>Bank interface preview</b><span>Fictional records · local changes only · no production reads or posting</span><label>Scenario <select aria-label="Bank preview scenario" value={scenario} onChange={event => { const next = event.target.value as BankStatement['status']; setScenario(next); setStatements([seed(next)]); setAdjustments(next === 'draft' ? [sampleAdjustment] : []) }}>{(['draft', 'prepared', 'approved'] as const).map(value => <option key={value}>{value}</option>)}</select></label><label className="ml-auto">Preview role <select aria-label="Preview role" value={role} onChange={event => setRole(event.target.value as CompanyRole)}>{(['admin', 'manager', 'accountant', 'viewer'] as const).map(value => <option key={value}>{value}</option>)}</select></label></div><HashRouter><AccountingShell userName={membership.displayName}><Routes><Route path="/accounting/:module" element={<AccountingWorkspace uid="isolated-bank" />} /><Route path="*" element={<AccountingWorkspace uid="isolated-bank" />} /></Routes></AccountingShell></HashRouter></CompanyRecordsPreview.Provider></CompanyContext.Provider>
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('test-root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<App />)
