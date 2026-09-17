import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { addInvoice, emptyBooks, parseBooks, reverse, settle, validateSupplierBillPdf, MAX_SUPPLIER_BILL_PDF_BYTES } from '../src/lib/accounting.ts'

const file = { path: 'companies/companyA/supplier-bills/upload_123', name: 'Supplier invoice.PDF', size: 4096, type: 'application/pdf' as const }
const bill = { kind: 'payable' as const, party: 'Saved supplier', partyId: 'vendor1', reference: 'B-1', date: '2026-09-01', due: '2026-09-30', amount: 11200, account: '5900', taxTreatment: 'VAT12' as const, supplierBillPdf: file }

test('supplier bill PDF and party snapshot survive posting, settlement, reversal, and backup restore', () => {
  const input = structuredClone(bill)
  let books = addInvoice(emptyBooks(), input)
  assert.notEqual(books.invoices[0].supplierBillPdf, input.supplierBillPdf)
  input.supplierBillPdf.name = 'Changed outside the ledger.pdf'
  books = settle(books, books.invoices[0].id, bill.amount, '2026-09-02', '1010', 'PAY-1')
  books = reverse(books, books.settlements[0].entryId, '2026-09-03')
  assert.deepEqual(books.invoices[0].supplierBillPdf, file)
  assert.equal(books.invoices[0].partyId, 'vendor1')
  assert.deepEqual(parseBooks(JSON.stringify(books)), books)
})

test('untrusted PDF metadata rejects foreign paths, URLs, unsupported fields, and invalid file details', () => {
  assert.deepEqual(validateSupplierBillPdf(file, 'companyA'), file)
  assert.throws(() => validateSupplierBillPdf(file, 'companyB'), /your company/)
  for (const patch of [
    { path: 'https://example.test/supplier.pdf' },
    { path: 'companies/companyA/supplier-bills/../private' },
    { path: 'companies/companyA/evidence/upload_123' },
    { path: 'companies/companyA/supplier-bills/nested/upload' },
    { name: '../supplier.pdf' }, { name: 'supplier\n.pdf' }, { name: 'x'.repeat(197) + '.pdf' }, { name: 'image.png' },
    { size: 0 }, { size: 1.5 }, { size: MAX_SUPPLIER_BILL_PDF_BYTES + 1 }, { size: '4096' },
    { type: 'text/html' }, { url: 'https://example.test/supplier.pdf' },
  ]) assert.throws(() => validateSupplierBillPdf({ ...file, ...patch }))
  assert.equal(validateSupplierBillPdf({ ...file, size: 1 }).size, 1)
  assert.equal(validateSupplierBillPdf({ ...file, size: MAX_SUPPLIER_BILL_PDF_BYTES }).size, MAX_SUPPLIER_BILL_PDF_BYTES)
})

test('receivables cannot carry supplier bill PDFs, including through a backup', () => {
  const invoice = { ...bill, kind: 'receivable' as const, account: '4100' }
  assert.throws(() => addInvoice(emptyBooks(), invoice), /only be attached to accounts payable/)
  const { supplierBillPdf: _, ...legacyInvoice } = invoice
  const books = addInvoice(emptyBooks(), legacyInvoice)
  books.invoices[0].supplierBillPdf = file
  assert.throws(() => parseBooks(JSON.stringify(books)), /only be attached to accounts payable/)
})

test('legacy bills without attachments still restore and the server uses the exact accounting engine', () => {
  const { supplierBillPdf: _, ...legacyBill } = bill
  const books = addInvoice(emptyBooks(), legacyBill)
  assert.equal(books.invoices[0].supplierBillPdf, undefined)
  assert.deepEqual(parseBooks(JSON.stringify(books)), books)
  assert.equal(readFileSync(new URL('../src/lib/accounting.ts', import.meta.url), 'utf8'), readFileSync(new URL('../functions/src/accounting-engine.ts', import.meta.url), 'utf8'))
})
