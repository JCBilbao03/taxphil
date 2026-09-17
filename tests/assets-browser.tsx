import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { AccountingWorkspace } from '../src/pages/AccountingPage'
import { AccountingShell } from '../src/components/accounting/AccountingShell'
import { CompanyContext, type CompanyContextValue, type CompanyRole } from '../src/hooks/useCompany'
import { CompanyRecordsPreview } from '../src/hooks/useCompanyRecords'
import { DEFAULT_COMPANY_PROFILE } from '../src/lib/ph-compliance'
import { emptyBooks, post } from '../src/lib/accounting'
import { assetAllocations, assetTaxSchedule, emptyAssetControl, previewAssetCommand, validateAssetAllocation, validateAssetCommand, type AssetInput, type AssetRecord, type AssetRun } from '../src/lib/assets'
import { suggestedMapping } from '../src/lib/tax-mapping'
import { buildReturnWorkingPaper, defaultReturnTemplates } from '../src/lib/tax-returns'
import '../src/index.css'

if (!import.meta.env.DEV) throw Error('Development fixture only')
let books = emptyBooks()
books.accounts.push(
  { code: '1510', name: 'Accumulated depreciation', type: 'Asset', cash: false }, { code: '1520', name: 'Accumulated impairment', type: 'Asset', cash: false },
  { code: '1550', name: 'Land', type: 'Asset', cash: false }, { code: '1600', name: 'Disposal proceeds clearing', type: 'Asset', cash: false },
  { code: '5500', name: 'Depreciation expense', type: 'Expense', cash: false }, { code: '5510', name: 'Impairment expense', type: 'Expense', cash: false },
  { code: '5520', name: 'Loss on disposal', type: 'Expense', cash: false }, { code: '4300', name: 'Gain on disposal', type: 'Revenue', cash: false },
)
books = post(books, { source: 'journal', date: '2026-01-01', reference: 'SAMPLE-ASSET-OPEN', description: 'Fictional opening equipment', lines: [{ account: '1500', debit: 2400000, credit: 0 }, { account: '1510', debit: 0, credit: 240000 }, { account: '3000', debit: 0, credit: 2160000 }] })
const sourceId = books.entries.at(-1)!.id
const sample: AssetInput = {
  code: 'EQ-DEMO-001', name: 'Office equipment · fictional sample', category: 'Office equipment', serialNumber: 'DEMO-1234', acquisitionDate: '2025-07-01', inServiceDate: '2025-07-01', basisDate: '2026-01-01',
  cost: 2400000, openingDepreciation: 240000, openingImpairment: 0, location: 'Sample Makati office', custodian: 'Sample finance team', notes: 'Fictional asset for isolated interface verification.', sourceMode: 'existing_entry', sourceEntryId: sourceId, openingEquityAccount: '',
  accounts: { cost: '1500', accumulatedDepreciation: '1510', depreciationExpense: '5500', accumulatedImpairment: '1520', impairmentExpense: '5510', disposalGain: '4300', disposalLoss: '5520' },
  bookPolicy: { method: 'straight_line', startMonth: '2026-01', usefulLifeMonths: 18, residualValue: 0, note: 'Fictional reviewed remaining life and timing for interface testing only.' },
  taxPolicy: { method: 'straight_line', startMonth: '2026-01', usefulLifeMonths: 24, residualValue: 0, basis: 2400000, openingDepreciation: 0, note: 'Fictional configured tax policy. This is not a statutory depreciation recommendation.' },
}
const initialAsset: AssetRecord = { ...sample, id: 'sample-equipment', version: 1, createdBy: 'sample-accountant', createdAt: '2026-01-02T01:00:00Z', events: [{ id: 'event-register', runId: 'register-sample', kind: 'register', date: sample.basisDate, reference: 'REGISTER-DEMO-001', note: sample.notes, entryId: '', costDelta: sample.cost, depreciationDelta: sample.openingDepreciation, impairmentDelta: 0, depreciationExpense: 0, proceeds: 0, location: sample.location, custodian: sample.custodian }] }
const registration: AssetRun = { id: 'register-sample', version: 2, status: 'posted', command: { kind: 'register', reference: 'REGISTER-DEMO-001', date: sample.basisDate, input: sample }, preparedBy: 'sample-accountant', preparedAt: '2026-01-02T01:00:00Z', preparedBooksRevision: 1, assetVersions: {}, preview: previewAssetCommand([], books, { kind: 'register', reference: 'REGISTER-DEMO-001', date: sample.basisDate, input: sample }), approvedBy: 'sample-manager', approvedAt: '2026-01-02T02:00:00Z', reviewNote: 'Fictional independent review of sample opening balances.', resultAssetIds: [initialAsset.id] }
const transfer: AssetRun = { id: 'transfer-sample', version: 1, status: 'draft', command: { kind: 'transfer', reference: 'MOVE-DEMO-001', date: '2026-09-01', assetId: initialAsset.id, location: 'Sample Cebu office', custodian: 'Sample operations team', note: 'Fictional transfer pending independent review.' }, preparedBy: 'sample-accountant', preparedAt: '2026-09-01T01:00:00Z', preparedBooksRevision: 1, assetVersions: { [initialAsset.id]: 1 }, preview: previewAssetCommand([initialAsset], books, { kind: 'transfer', reference: 'MOVE-DEMO-001', date: '2026-09-01', assetId: initialAsset.id, location: 'Sample Cebu office', custodian: 'Sample operations team', note: 'Fictional transfer pending independent review.' }) }

const mapping = books.accounts.map(account => ({ account: account.code, category: suggestedMapping(account) || 'other_expenses' as const, note: 'Fictional preview mapping for interface testing.' }))
const taxPaper = { id: 'asset-tax-snapshot', version: 1, ...buildReturnWorkingPaper(books, mapping, defaultReturnTemplates.find(template => template.code === '1702-RT')!, [], '2026-01-01', '2026-08-31'), form: '1702-RT', from: '2026-01-01', to: '2026-08-31', status: 'draft', createdBy: 'sample-accountant', createdAt: '2026-09-01T02:00:00Z', booksRevision: 1, mappingVersion: 1, templateVersion: 0, registerVersion: 0, assetRevision: 2, assetScheduleSnapshot: [assetTaxSchedule(initialAsset, '2026-01-01', '2026-08-31')] }
function App() {
  const [role, setRole] = useState<CompanyRole>('admin'), [runs, setRuns] = useState<AssetRun[]>([registration, transfer]), [control, setControl] = useState({ ...emptyAssetControl(), revision: 2, assetCount: 1, allocations: assetAllocations(sample), protectedEntryIds: [sourceId] })
  const assets = [initialAsset], membership = { uid: `sample-${role}`, email: `${role}@example.test`, displayName: `Sample ${role}`, companyId: 'isolated-assets', companyCode: 'PH-ASSET-DEMO', role, active: true }
  const invoke: CompanyContextValue['invoke'] = async (name, data) => {
    if (name !== 'companyAssets') throw Error('Only the isolated asset preview is enabled.')
    if (role === 'viewer') throw Error('Viewer access is read-only.')
    if (data.expectedRevision !== control.revision) throw Error('Preview revision changed. Refresh the proposed action.')
    if (data.action === 'prepare') {
      const command = validateAssetCommand(data.command, books)
      if (command.kind === 'register') validateAssetAllocation(command.input, books, control.allocations)
      if (command.kind === 'reverse') throw Error('The reversal dialog is available here; reversal persistence is verified by the backend tests, not this isolated fixture.')
      const id = String(data.requestId), result = previewAssetCommand(assets, books, command)
      const selected = command.kind === 'register' ? [] : command.kind === 'depreciation' ? command.assetIds : [command.assetId]
      const run: AssetRun = { id, version: 1, status: 'draft', command, preparedBy: membership.uid, preparedAt: new Date().toISOString(), preparedBooksRevision: 1, assetVersions: Object.fromEntries(selected.map(id => [id, assets.find(asset => asset.id === id)!.version])), preview: result }
      setRuns(old => [...old, run]); setControl(old => ({ ...old, revision: old.revision + 1 }))
      return { id, status: 'draft' } as never
    }
    if (!['admin', 'manager'].includes(role)) throw Error('Use an independent Admin or Manager for review.')
    const run = runs.find(run => run.id === data.id)
    if (!run) throw Error('Preview action is missing.')
    if (data.action === 'reject') { setRuns(old => old.map(row => row.id === run.id ? { ...row, status: 'rejected', reviewNote: String(data.reviewNote) } : row)); setControl(old => ({ ...old, revision: old.revision + 1 })); return { id: run.id, status: 'rejected' } as never }
    if (run.preparedBy === membership.uid) throw Error('A different reviewer must approve this action.')
    throw Error('This isolated fixture checks previews, forms and review controls. Real approval and atomic journal posting are tested separately against the backend handler.')
  }
  const value: CompanyContextValue = { membership, company: { companyCode: membership.companyCode, profile: { ...DEFAULT_COMPANY_PROFILE, registeredName: 'Fictional Asset Preview Company' } }, books, revision: 1, members: [], approvals: [], audit: [], loading: false, busy: false, error: '', booksReady: true, invoke, command: async () => { throw Error('Isolated asset fixture only.') } }
  return <CompanyContext.Provider value={value}><CompanyRecordsPreview.Provider value={{ assets, assetRuns: runs, assetControl: [{ id: 'default', ...control }], taxMappings: [{ id: 'default', version: 1, mappings: mapping }], taxRegisters: [], taxTemplates: [], taxDrafts: [taxPaper] }}><div className="flex flex-wrap items-center gap-3 bg-amber-50 px-5 py-3 text-sm text-amber-900"><b>Asset interface preview</b><span>Fictional records · no production reads, posting or auth</span><label className="ml-auto">Preview role <select aria-label="Preview role" value={role} onChange={event => setRole(event.target.value as CompanyRole)}>{(['admin', 'manager', 'accountant', 'viewer'] as const).map(value => <option key={value}>{value}</option>)}</select></label></div><HashRouter><AccountingShell userName={membership.displayName}><Routes><Route path="/accounting/:module" element={<AccountingWorkspace uid="isolated-assets" />} /><Route path="*" element={<AccountingWorkspace uid="isolated-assets" />} /></Routes></AccountingShell></HashRouter></CompanyRecordsPreview.Provider></CompanyContext.Provider>
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('test-root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<App />)
