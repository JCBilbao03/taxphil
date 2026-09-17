import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { addInvoice, appendSettlementDocuments, balances, closePeriod, emptyBooks, outstanding, parseBooks, reverse, settle, validateSettlementSupportingDocuments, validateSettlementSupportingDocument, MAX_SETTLEMENT_DOCUMENT_BYTES, MAX_SETTLEMENT_DOCUMENTS, SETTLEMENT_DOCUMENT_KINDS, type SettlementSupportingDocument } from '../src/lib/accounting.ts'

const approval: SettlementSupportingDocument = { path: 'companies/companyA/settlement-evidence/approval_1', name: 'Payment approval.pdf', size: 4096, type: 'application/pdf', kind: 'payment_approval' }
const wire: SettlementSupportingDocument = { path: 'companies/companyA/settlement-evidence/wire_1', name: 'Bank transfer.png', size: 2048, type: 'image/png', kind: 'transfer_confirmation' }
const deposit: SettlementSupportingDocument = { path: 'companies/companyA/settlement-evidence/deposit_1', name: 'Deposit slip.JPG', size: 8192, type: 'image/jpeg', kind: 'deposit_slip' }
const bill = { kind: 'payable' as const, party: 'Supplier', reference: 'B-1', date: '2026-09-01', due: '2026-09-30', amount: 11200, account: '5900', supplierBillPdf: { path: 'companies/companyA/supplier-bills/source_1', name: 'Supplier invoice.pdf', size: 3000, type: 'application/pdf' as const } }

test('each partial payment keeps its own immutable document snapshot and the supplier PDF remains on its source bill', () => {
  let books = addInvoice(emptyBooks(), bill)
  const input = structuredClone([approval, wire])
  books = settle(books, books.invoices[0].id, 2000, '2026-09-02', '1010', 'PAY-1', input)
  input[0].name = 'Changed after saving.pdf'
  input.pop()
  books = settle(books, books.invoices[0].id, 3000, '2026-09-03', '1010', 'PAY-2', [wire])
  assert.deepEqual(books.settlements[0].supportingDocuments, [approval, wire])
  assert.deepEqual(books.settlements[1].supportingDocuments, [wire])
  assert.equal(outstanding(books, books.invoices[0]), 6200)
  assert.deepEqual(books.invoices[0].supplierBillPdf, bill.supplierBillPdf)
  books = reverse(books, books.settlements[0].entryId, '2026-09-04')
  assert.equal(outstanding(books, books.invoices[0]), 8200)
  assert.deepEqual(books.settlements[0].supportingDocuments, [approval, wire])
  assert.deepEqual(parseBooks(JSON.stringify(books)), books)
})

test('receipt evidence is retained, legacy settlements remain compatible, and unsupported kinds fail even in backups', () => {
  const { supplierBillPdf: _, ...source } = bill
  let books = addInvoice(emptyBooks(), { ...source, kind: 'receivable', account: '4100' })
  const id = books.invoices[0].id
  assert.throws(() => settle(books, id, 1000, '2026-09-02', '1010', 'REC-X', [approval]), /type allowed/)
  books = settle(books, id, 1000, '2026-09-02', '1010', 'REC-1', [deposit, wire])
  books = settle(books, id, 1000, '2026-09-03', '1010', 'REC-2')
  assert.deepEqual(books.settlements[0].supportingDocuments, [deposit, wire])
  assert.equal(books.settlements[1].supportingDocuments, undefined)
  assert.deepEqual(parseBooks(JSON.stringify(books)), books)
  const corrupted = structuredClone(books)
  corrupted.settlements[0].supportingDocuments = [approval]
  assert.throws(() => parseBooks(JSON.stringify(corrupted)), /type allowed/)
})

test('document categories are restricted to the transaction direction while transfer confirmations support both', () => {
  for (const kind of SETTLEMENT_DOCUMENT_KINDS.payable) assert.equal(validateSettlementSupportingDocument({ ...approval, kind }, 'payable').kind, kind)
  for (const kind of SETTLEMENT_DOCUMENT_KINDS.receivable) assert.equal(validateSettlementSupportingDocument({ ...approval, kind }, 'receivable').kind, kind)
  assert.throws(() => validateSettlementSupportingDocument(deposit, 'payable'), /type allowed/)
  assert.throws(() => validateSettlementSupportingDocument({ ...approval, kind: 'vendor_collection_receipt' }, 'receivable'), /type allowed/)
})

test('supporting document validation rejects foreign paths, external URLs, unsafe names and inconsistent file metadata', () => {
  assert.deepEqual(validateSettlementSupportingDocument(approval, 'payable', 'companyA'), approval)
  assert.throws(() => validateSettlementSupportingDocument(approval, 'payable', 'companyB'), /your company/)
  for (const patch of [
    { path: 'https://example.test/approval.pdf' }, { path: 'companies/companyA/settlement-evidence/../file' }, { path: 'companies/companyA/supplier-bills/file' },
    { name: '../approval.pdf' }, { name: 'approval\n.pdf' }, { name: 'x'.repeat(201) }, { name: 'image.jpg' },
    { size: 0 }, { size: 1.5 }, { size: MAX_SETTLEMENT_DOCUMENT_BYTES + 1 }, { size: '4096' },
    { type: 'text/html' }, { kind: 'invoice' }, { url: 'https://example.test/approval.pdf' },
  ]) assert.throws(() => validateSettlementSupportingDocument({ ...approval, ...patch }))
  assert.equal(validateSettlementSupportingDocument({ ...approval, size: 1 }).size, 1)
  assert.equal(validateSettlementSupportingDocument({ ...deposit, size: MAX_SETTLEMENT_DOCUMENT_BYTES }).size, MAX_SETTLEMENT_DOCUMENT_BYTES)
})

test('arrays enforce ten unique documents and restore cannot bypass those limits', () => {
  const files = Array.from({ length: MAX_SETTLEMENT_DOCUMENTS }, (_, index) => ({ ...approval, path: `companies/companyA/settlement-evidence/file_${index}` }))
  assert.equal(validateSettlementSupportingDocuments(files).length, 10)
  assert.deepEqual(validateSettlementSupportingDocuments([]), [])
  assert.throws(() => validateSettlementSupportingDocuments([...files, wire]), /at most 10/)
  assert.throws(() => validateSettlementSupportingDocuments([approval, approval]), /only once/)
  assert.throws(() => validateSettlementSupportingDocuments(null), /at most 10/)
  let books = addInvoice(emptyBooks(), bill)
  books = settle(books, books.invoices[0].id, 1000, '2026-09-02', '1010', 'PAY-1')
  books.settlements[0].supportingDocuments = [approval, approval]
  assert.throws(() => parseBooks(JSON.stringify(books)), /only once/)
  assert.equal(readFileSync(new URL('../src/lib/accounting.ts', import.meta.url), 'utf8'), readFileSync(new URL('../functions/src/accounting-engine.ts', import.meta.url), 'utf8'))
})

test('late documents append to fully paid and closed-period records without changing ledger or original evidence', () => {
  let books = addInvoice(emptyBooks(), bill)
  books = settle(books, books.invoices[0].id, bill.amount, '2026-09-02', '1010', 'PAY-1', [approval])
  books = closePeriod(books, '2026-09-03')
  const original = structuredClone(books), input = structuredClone([wire])
  const next = appendSettlementDocuments(books, books.settlements[0].id, input)
  input[0].name = 'Changed.png'
  assert.deepEqual(next.settlements[0].supportingDocuments, [approval, wire])
  assert.deepEqual(next.entries, original.entries)
  assert.deepEqual(next.invoices, original.invoices)
  assert.equal(next.closedThrough, original.closedThrough)
  assert.deepEqual(balances(next), balances(original))
  assert.equal(outstanding(next, next.invoices[0]), 0)
  assert.deepEqual(books, original)
  assert.deepEqual(parseBooks(JSON.stringify(next)), next)
})

test('append rejects missing settlements, empty documents, wrong direction, existing duplicates and combined overflow', () => {
  let books = addInvoice(emptyBooks(), bill)
  books = settle(books, books.invoices[0].id, 1000, '2026-09-02', '1010', 'PAY-1', [approval])
  const id = books.settlements[0].id, original = structuredClone(books)
  assert.throws(() => appendSettlementDocuments(books, 'missing', [wire]), /not found/)
  assert.throws(() => appendSettlementDocuments(books, id, []), /at least one/)
  assert.throws(() => appendSettlementDocuments(books, id, [deposit]), /type allowed/)
  assert.throws(() => appendSettlementDocuments(books, id, [approval]), /only once/)
  const ten = Array.from({ length: 10 }, (_, index) => ({ ...wire, path: `companies/companyA/settlement-evidence/new_${index}` }))
  assert.throws(() => appendSettlementDocuments(books, id, ten), /at most 10/)
  assert.deepEqual(books, original)
})
