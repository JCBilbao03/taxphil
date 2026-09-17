import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { formatPartyTin, normalizePartyTin, partyInvoiceSnapshot, validateParty, type Party } from '../src/lib/parties.ts'
import { addInvoice, emptyBooks, parseBooks } from '../src/lib/accounting.ts'

const vendor = { kind: 'vendor' as const, registeredName: 'Example Trading', tin: '123-456-789', address: 'Makati City', email: '', defaultAtc: 'WC010', notes: '', active: true }
const party: Party = { ...validateParty(vendor), id: 'vendor1', version: 1, createdAt: '', createdBy: '', updatedAt: '', updatedBy: '' }

test('TIN normalization unifies base, legacy branch and five-digit branch formats', () => {
  assert.equal(normalizePartyTin('123-456-789'), '12345678900000')
  assert.equal(normalizePartyTin('123456789000'), '12345678900000')
  assert.equal(normalizePartyTin('123-456-789-001'), '12345678900001')
  assert.equal(normalizePartyTin('123-456-789-00001'), '12345678900001')
  assert.equal(formatPartyTin('12345678900001'), '123-456-789-00001')
  for (const value of ['', '12345678', '12345678901', '000000000', 'TIN123456789', '123456789<script>', '123456789000000']) assert.throws(() => normalizePartyTin(value))
})

test('both vendor and customer setup require registered name, TIN and address', () => {
  for (const kind of ['vendor', 'customer']) {
    assert.equal(validateParty({ ...vendor, kind }).tin, '123-456-789-00000')
    for (const field of ['tin', 'registeredName', 'address']) assert.throws(() => validateParty({ ...vendor, kind, [field]: '' }))
  }
  assert.throws(() => validateParty({ ...vendor, email: 'not-email' }))
  assert.throws(() => validateParty({ ...vendor, defaultAtc: 'NOTATC' }))
  assert.throws(() => validateParty({ ...vendor, active: 'true' }))
})

test('invoice selection permits only active records of the correct party kind', () => {
  assert.deepEqual(partyInvoiceSnapshot(party, 'payable'), { partyId: 'vendor1', party: 'Example Trading', partyTin: '123-456-789-00000', partyAddress: 'Makati City' })
  assert.throws(() => partyInvoiceSnapshot(party, 'receivable'))
  assert.throws(() => partyInvoiceSnapshot({ ...party, active: false }, 'payable'))
  assert.equal(partyInvoiceSnapshot({ ...party, kind: 'customer' }, 'receivable').partyId, 'vendor1')
})

test('posted invoice keeps its TIN snapshot and party link across directory edits and backup parsing', () => {
  const input = { ...partyInvoiceSnapshot(party, 'payable'), kind: 'payable' as const, reference: 'BILL-01', date: '2026-09-17', due: '2026-09-30', amount: 11200, account: '5900', taxTreatment: 'NON_VAT' as const }
  const books = addInvoice(emptyBooks(), input)
  const changed = { ...party, tin: '987-654-321-00000', registeredName: 'Updated name' }
  assert.notEqual(partyInvoiceSnapshot(changed, 'payable').partyTin, books.invoices[0].partyTin)
  const restored = parseBooks(JSON.stringify(books))
  assert.equal(restored.invoices[0].partyId, 'vendor1')
  assert.equal(restored.invoices[0].partyTin, '123-456-789-00000')
  const { partyId: _partyId, ...legacy } = input
  assert.equal(parseBooks(JSON.stringify(addInvoice(emptyBooks(), legacy))).invoices[0].partyId, undefined)
  assert.throws(() => addInvoice(emptyBooks(), { ...input, partyId: '../other-company' }))
})

test('frontend and server directory validation stay identical', () => {
  assert.equal(readFileSync(new URL('../src/lib/parties.ts', import.meta.url), 'utf8'), readFileSync(new URL('../functions/src/parties.ts', import.meta.url), 'utf8'))
})
