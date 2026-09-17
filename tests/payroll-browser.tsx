import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AccountingWorkspace } from '../src/pages/AccountingPage'
import { AccountingShell } from '../src/components/accounting/AccountingShell'
import { CompanyContext, type CompanyContextValue, type CompanyRole } from '../src/hooks/useCompany'
import { CompanyRecordsPreview } from '../src/hooks/useCompanyRecords'
import { DEFAULT_COMPANY_PROFILE } from '../src/lib/ph-compliance'
import { emptyBooks } from '../src/lib/accounting'
import { blankPayrollRow, calculatePayrollRun, validateEmployee, type PayrollRun } from '../src/lib/payroll'
import '../src/index.css'

if (!import.meta.env.DEV) throw Error('Development fixture only')
const books = emptyBooks()
books.accounts.push(
  { code: '5210', name: 'Employer statutory contributions', type: 'Expense', cash: false },
  ...[
    ['2210', 'Salaries payable'], ['2220', 'SSS and EC payable'], ['2230', 'PhilHealth payable'],
    ['2240', 'Pag-IBIG payable'], ['2250', 'Compensation withholding payable'],
    ['2260', 'Employee loans payable'], ['2270', 'Other payroll deductions payable'],
  ].map(([code, name]) => ({ code, name, type: 'Liability' as const, cash: false })),
)
const employees = [validateEmployee({
  code: 'DEMO-EMP-001', fullName: 'Fictional Payroll Employee', tin: '900000001',
  sssNumber: '9000000001', philhealthNumber: '900000000001', pagibigNumber: '900000000002',
  address: 'Fictional office address, Makati City', compensationAtc: 'WC010',
  jobTitle: 'Sample accounting officer', department: 'Fictional finance team',
  startDate: '2025-01-01', endDate: '', active: true, payFrequency: 'monthly', basicPay: 4000000,
  notes: 'Synthetic employee and identification numbers for isolated interface testing only.',
}, 'fictional-payroll-employee', 1)]
const employeeRevision = 1
const accounts = { salaryExpense: '5200', employerExpense: '5210', netPayable: '2210', sssPayable: '2220', philhealthPayable: '2230', pagibigPayable: '2240', withholdingPayable: '2250', loansPayable: '2260', otherPayable: '2270' }
type SavedRun = PayrollRun & { id: string; version: number; status: 'draft' | 'posted'; createdBy: string; createdByEmail: string; companyName: string; createdAt: string; updatedAt: string }
const initial: SavedRun = {
  ...calculatePayrollRun({ reference: 'DEMO-PAY-AUG-2026', periodStart: '2026-08-01', periodEnd: '2026-08-31', payDate: '2026-08-31', frequency: 'monthly', rows: [{ ...blankPayrollRow(employees[0]), taxableCompensation: 4000000, note: 'Fictional full-month payroll. Contributions and tax still require calculator review.' }], accounts, calculationsReviewed: false, calculationNote: 'Isolated August 2026 calculator draft; no salary payment, posting or government submission.' }, employees, employeeRevision),
  id: 'fictional-payroll-aug-2026', version: 1, status: 'draft', createdBy: 'sample-accountant', createdByEmail: 'accountant@example.test', companyName: 'Fictional Payroll Preview Company', createdAt: '2026-09-01T01:00:00Z', updatedAt: '2026-09-01T01:00:00Z',
}
function App() {
  const [role, setRole] = useState<CompanyRole>('accountant'), [runs, setRuns] = useState<SavedRun[]>([initial])
  const membership = { uid: `sample-${role}`, email: `${role}@example.test`, displayName: `Sample ${role}`, companyId: 'isolated-payroll', companyCode: 'PH-PAY-DEMO', role, active: true }
  const invoke: CompanyContextValue['invoke'] = async (name, data) => {
    if (name !== 'companyPayroll' || data.action !== 'saveRun') throw Error('Only in-memory payroll draft saving is enabled. This fixture never posts, writes employee records, pays salaries, or contacts production.')
    if (role === 'viewer') throw Error('Viewer access is read-only.')
    if (data.expectedEmployeeRevision !== employeeRevision) throw Error('Preview employee revision changed. Reopen the draft.')
    const previous = data.id ? runs.find(run => run.id === data.id) : undefined
    if (data.id && !previous) throw Error('The synthetic payroll draft was not found.')
    if (Number(data.expectedRevision) !== (previous?.version || 0)) throw Error('Preview draft changed. Reopen it before saving.')
    if (previous && (previous.createdBy !== membership.uid || previous.status !== 'draft')) throw Error('Only the synthetic draft’s preparer may edit it. Select the Accountant preview role.')
    const calculated = calculatePayrollRun(data.input, employees, employeeRevision), timestamp = new Date().toISOString()
    const record: SavedRun = { ...calculated, id: previous?.id || crypto.randomUUID(), version: (previous?.version || 0) + 1, status: 'draft', createdBy: membership.uid, createdByEmail: membership.email, companyName: initial.companyName, createdAt: previous?.createdAt || timestamp, updatedAt: timestamp }
    setRuns(old => [...old.filter(run => run.id !== record.id), record])
    return { id: record.id, version: record.version, status: 'draft' } as never
  }
  const value: CompanyContextValue = { membership, company: { companyCode: membership.companyCode, profile: { ...DEFAULT_COMPANY_PROFILE, registeredName: initial.companyName, hasEmployees: true } }, books, revision: 0, members: [], approvals: [], audit: [], loading: false, busy: false, error: '', booksReady: true, invoke, command: async () => { throw Error('Ledger writes are disabled in the isolated payroll fixture.') } }
  const preview = useMemo(() => ({ employees: [{ id: 'default', employees, revision: employeeRevision }], payrollRuns: runs }), [runs])
  return <CompanyContext.Provider value={value}><CompanyRecordsPreview.Provider value={preview}><div className="flex flex-wrap items-center gap-3 bg-amber-50 px-5 py-3 text-sm text-amber-900"><b>Payroll calculator interface preview</b><span>Fictional employee · August 2026 full month · no production reads or writes</span><label className="ml-auto">Preview role <select aria-label="Preview role" value={role} onChange={event => setRole(event.target.value as CompanyRole)}>{(['accountant', 'admin', 'manager', 'viewer'] as const).map(value => <option key={value}>{value}</option>)}</select></label></div><HashRouter><AccountingShell userName={membership.displayName}><Routes><Route path="/accounting/:module" element={<AccountingWorkspace uid="isolated-payroll" />} /><Route path="*" element={<AccountingWorkspace uid="isolated-payroll" />} /></Routes></AccountingShell></HashRouter></CompanyRecordsPreview.Provider></CompanyContext.Provider>
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('test-root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<App />)
