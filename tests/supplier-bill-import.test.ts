import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { extractSupplierBill } from '../src/lib/supplier-bill-extraction.ts'
import { planSupplierBillImport } from '../src/lib/supplier-bill-import.ts'

const text = readFileSync(new URL('./fixtures/supplier-bills/text-invoice.txt', import.meta.url), 'utf8')
const vendors = [{ id: 'vendor1', kind: 'vendor', active: true, tin: '321-654-987-00000', registeredName: 'Metro Office Supply' }, { id: 'customer1', kind: 'customer', active: true, tin: '123-456-789-00000', registeredName: 'Mabuhay Trading, Inc.' }]

test('printed supplier PDF fixture fills the supplier rather than the buyer, reference, dates and PHP total', () => {
  const result = planSupplierBillImport(extractSupplierBill(text), vendors, new Set())
  assert.deepEqual(result.changes, { date: '2026-09-15', due: '2026-09-30', reference: 'TEST-PDF-002', amount: '2240.00', documentDescription: 'Office stationery and printer paper', partyId: 'vendor1' })
})

test('manual changes made while PDF is being read survive extraction', () => {
  const result = planSupplierBillImport(extractSupplierBill(text), vendors, new Set(['amount', 'reference', 'partyId']))
  assert.equal(result.changes.amount, undefined)
  assert.equal(result.changes.reference, undefined)
  assert.equal(result.changes.partyId, undefined)
  assert.equal(result.changes.date, '2026-09-15')
  assert.ok(result.notes.some(note => note.includes('manually entered')))
})

test('unreadable or conflicting dates and amounts clear imported defaults and require manual entry', () => {
  const result = planSupplierBillImport(extractSupplierBill('Invoice Date: 09/10/2026\nGrand Total: 1.000,00'), vendors, new Set())
  assert.equal(result.changes.date, '')
  assert.equal(result.changes.due, '')
  assert.equal(result.changes.amount, '')
  assert.equal(result.changes.partyId, '')
})

test('a supplier absent from the company directory is not created or matched by name', () => {
  const result = planSupplierBillImport(extractSupplierBill(text), [{ ...vendors[0], tin: '555-444-333-00000' }], new Set())
  assert.equal(result.changes.partyId, '')
  assert.ok(result.notes.some(note => note.includes('vendor directory')))
})
