import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractSupplierBill, matchSupplierVendor, normalizeSupplierBillAmount, normalizeSupplierBillDate } from '../src/lib/supplier-bill-extraction.ts'

const standard = `ACME TRADING INC.
123 Example Street, Barangay Uno
Makati City 1200
VAT Registered TIN: 123-456-789-00001
SALES INVOICE
Invoice No.: SI-2026-015
Invoice Date: 17 September 2026
Due Date: October 17, 2026
Bill To: Sample Customer Corporation
Customer TIN: 987-654-321-00000
Address: 88 Customer Road, Pasig City
Description: Monthly accounting supplies
Subtotal: PHP 1,000.00
VAT (12%): PHP 120.00
Grand Total: PHP 1,120.00`

test('a labeled PHP invoice extracts usable suggestions with original one-based evidence', () => {
  const result = extractSupplierBill(standard)
  assert.deepEqual(result.fields, {
    vendorTin: '123-456-789-00001', reference: 'SI-2026-015', date: '2026-09-17', due: '2026-10-17',
    description: 'Monthly accounting supplies', netAmount: '1000.00', vatAmount: '120.00', total: '1120.00',
    vendorName: 'ACME TRADING INC.', vendorAddress: '123 Example Street, Barangay Uno, Makati City 1200',
  })
  assert.deepEqual(result.evidence.total, { value: '1120.00', lines: [15], text: 'Grand Total: PHP 1,120.00' })
  assert.deepEqual(result.evidence.vendorTin?.lines, [4])
  assert.match(result.warnings.join(' '), /customer TIN details were excluded/i)
  assert.doesNotMatch(result.warnings.join(' '), /conflicting|ambiguous|does not equal/i)
})

test('column labels on separate reading-order lines and explicit supplier fields are supported', () => {
  const result = extractSupplierBill(`Supplier Name: Example Advisory
Supplier Address: Unit 3 Example Building
Makati City
Supplier TIN:
222 333 444 001
Invoice Number
INV/2026/119
Invoice Date
2026-09-17
Payment Due Date
30/09/2026
Description:
Advisory service for September
Net Amount
P 2 500.00
VAT Amount
₱ 300.00
Total Amount
PHP
2,800.00`)
  assert.equal(result.fields.reference, 'INV/2026/119')
  assert.equal(result.fields.vendorName, 'Example Advisory')
  assert.equal(result.fields.vendorAddress, 'Unit 3 Example Building, Makati City')
  assert.equal(result.fields.vendorTin, '222-333-444-001')
  assert.equal(result.fields.date, '2026-09-17')
  assert.equal(result.fields.due, '2026-09-30')
  assert.equal(result.fields.total, '2800.00')
  assert.equal(result.fields.vatAmount, '300.00')
  assert.equal(result.fields.netAmount, '2500.00')
  assert.deepEqual(result.evidence.total?.lines, [18, 19, 20])
})

test('adjacent labeled header fields do not leak dates or customer identity into the supplier', () => {
  const result = extractSupplierBill(`Supplier Name: Example Trading Inc.  TIN: 123-456-789
Invoice No: INV-008  Invoice Date: 2026-09-17  Due Date: 2026-09-30
Supplier TIN: 123-456-789  Buyer TIN: 987-654-321
Grand Total: PHP 123.00`)
  assert.equal(result.fields.vendorName, 'Example Trading Inc.')
  assert.equal(result.fields.reference, 'INV-008')
  assert.equal(result.fields.date, '2026-09-17')
  assert.equal(result.fields.due, '2026-09-30')
  assert.equal(result.fields.vendorTin, '123-456-789')
  assert.ok(result.candidates.vendorTin?.every(candidate => candidate.value === '123-456-789'))
})

test('ambiguous numeric dates and impossible calendar dates stay blank, including a conflicting valid date', () => {
  for (const input of ['09/10/2026', '10-09-2026', '02.03.2026', '2026-02-29', '31/04/2026', '17/09/26']) {
    const result = extractSupplierBill(`Invoice Date: ${input}\nDue Date: 2026-10-30`)
    assert.equal(result.fields.date, undefined, input)
    assert.equal(result.fields.due, '2026-10-30')
    assert.equal(result.candidates.date?.[0].value, input)
    assert.ok(result.warnings.length)
  }
  assert.equal(extractSupplierBill('Invoice Date: 2026-09-17\nInvoice Date: 09/10/2026').fields.date, undefined)
  for (const [raw, expected] of [['09/17/2026', '2026-09-17'], ['17/09/2026', '2026-09-17'], ['09/09/2026', '2026-09-09'], ['February 29, 2024', '2024-02-29'], ['17th Sep. 2026', '2026-09-17'], ['2026/09/17', '2026-09-17']]) assert.equal(normalizeSupplierBillDate(raw).value, expected)
})

test('amount parsing neither repairs OCR substitutions nor assumes decimal locales', () => {
  for (const raw of ['1.120,00', '1,12', '1.120', '1,12O.00', '1,12,000.00', '1,000.000', '-100.00', '(100.00)', 'Infinity', '1e4', '10000000000.00', '<script>100</script>']) assert.equal(normalizeSupplierBillAmount(raw).value, undefined, raw)
  for (const [raw, expected] of [['PHP 1,120.00', '1120.00'], ['₱1120', '1120.00'], ['P 1 120.50', '1120.50'], ['1,120.5 PHP', '1120.50'], ['0.00', '0.00'], ['123', '123.00']]) assert.equal(normalizeSupplierBillAmount(raw).value, expected)
  const broken = extractSupplierBill('Grand Total: PHP 1,12O.00')
  assert.equal(broken.fields.total, undefined)
  assert.match(broken.warnings.join(' '), /OCR|ambiguous/i)
})

test('conflicting invoice references and totals cannot silently select the first PDF invoice', () => {
  const result = extractSupplierBill(`Invoice No: INV-1
Grand Total: PHP 100.00
Invoice No: INV-2
Grand Total: PHP 200.00`)
  assert.equal(result.fields.reference, undefined)
  assert.equal(result.fields.total, undefined)
  assert.equal(result.candidates.reference?.length, 2)
  assert.equal(result.candidates.total?.length, 2)
  assert.match(result.warnings.join(' '), /Conflicting invoice reference/)
  const duplicate = extractSupplierBill('Invoice No: INV-1\nGrand Total: PHP 100.00\nInvoice No: INV-1\nGrand Total: PHP 100.00')
  assert.equal(duplicate.fields.reference, 'INV-1')
  assert.equal(duplicate.fields.total, '100.00')
})

test('subtotal and payable balance never replace a gross invoice total', () => {
  const result = extractSupplierBill(`Subtotal: PHP 1,000.00
VAT: PHP 120.00
Grand Total: PHP 1,120.00
Less Withholding: PHP 20.00
Amount Due: PHP 1,100.00`)
  assert.equal(result.fields.total, '1120.00')
  assert.equal(result.fields.netAmount, '1000.00')
  assert.match(result.warnings.join(' '), /payable balance may differ/i)
  const onlyBalance = extractSupplierBill('Subtotal: PHP 1,000.00\nAmount Due: PHP 900.00')
  assert.equal(onlyBalance.fields.total, undefined)
  assert.equal(onlyBalance.fields.netAmount, '1000.00')
  assert.match(onlyBalance.warnings.join(' '), /gross invoice total manually/i)
  assert.equal(extractSupplierBill('Subtotal: PHP 1,000.00').fields.total, undefined)
})

test('VATable sales do not capture the VAT tax amount or become full net sales on mixed invoices', () => {
  const standard = extractSupplierBill('VATable Sales: PHP 1,000.00\n12% VAT: PHP 120.00\nGrand Total: PHP 1,120.00')
  assert.equal(standard.fields.netAmount, '1000.00')
  assert.equal(standard.fields.vatAmount, '120.00')
  const mixed = extractSupplierBill('VATable Sales: PHP 1,000.00\nVAT Exempt Sales: PHP 500.00\nVAT Amount: PHP 120.00\nGrand Total: PHP 1,620.00')
  assert.equal(mixed.fields.netAmount, undefined)
  assert.equal(mixed.fields.vatAmount, '120.00')
  assert.match(mixed.warnings.join(' '), /full net amount/i)
})

test('VAT/net mismatches and due dates before the invoice are flagged without changing printed figures', () => {
  const result = extractSupplierBill('Invoice Date: 2026-09-17\nDue Date: 2026-09-16\nNet Amount: PHP 1,000.00\nVAT: PHP 120.00\nGrand Total: PHP 1,100.00')
  assert.equal(result.fields.total, '1100.00')
  assert.match(result.warnings.join(' '), /does not equal/)
  assert.match(result.warnings.join(' '), /before the invoice date/)
})

test('missing, foreign and mixed currencies preserve candidates but do not populate money', () => {
  for (const amount of ['USD 100.00', '$100.00', 'EUR 100.00', '100.00']) {
    const result = extractSupplierBill(`Invoice No: INV-10\nGrand Total: ${amount}`)
    assert.equal(result.fields.total, undefined)
    assert.equal(result.fields.reference, 'INV-10')
    assert.ok(result.candidates.total?.length)
    assert.match(result.warnings.join(' '), /currency|non-PHP/i)
  }
  const mixed = extractSupplierBill('Currency: USD\nPHP Equivalent\nNet Amount: PHP 5,000.00\nVAT: PHP 600.00\nGrand Total: PHP 5,600.00')
  assert.equal(mixed.fields.total, undefined)
  assert.equal(mixed.fields.netAmount, undefined)
  assert.equal(mixed.fields.vatAmount, undefined)
  assert.equal(extractSupplierBill('Invoice No: INV-PHP-100\nGrand Total: 100.00').fields.total, undefined)
})

test('credit notes retain identity evidence while positive and negative money require separate review', () => {
  for (const total of ['PHP 100.00', 'PHP -100.00', 'PHP (100.00)']) {
    const result = extractSupplierBill(`CREDIT NOTE\nInvoice No: CN-10\nGrand Total: ${total}`)
    assert.equal(result.fields.reference, 'CN-10')
    assert.equal(result.fields.total, undefined)
    assert.match(result.warnings.join(' '), /credit note or refund/)
  }
  const printingSupplies = extractSupplierBill('Description: Credit note printing and printer paper\nGrand Total: PHP 100.00')
  assert.equal(printingSupplies.fields.total, '100.00')
  assert.equal(printingSupplies.fields.description, 'Credit note printing and printer paper')
  assert.doesNotMatch(printingSupplies.warnings.join(' '), /credit note or refund/)
})

test('PDF page boundaries reset printer-footer exclusion and expose conflicting invoices on later pages', () => {
  const result = extractSupplierBill(`--- Page 1 ---
Example Trading Inc.
Invoice No: INV-1
Grand Total: PHP 100.00
Printed by: Example Printing
TIN: 555-666-777

--- Page 2 ---
Invoice No: INV-2
Grand Total: PHP 200.00`)
  assert.equal(result.fields.reference, undefined)
  assert.equal(result.fields.total, undefined)
  assert.equal(result.fields.vendorTin, undefined)
  assert.equal(result.candidates.total?.length, 2)
  assert.equal(result.fields.vendorName, 'Example Trading Inc.')
  const continuation = extractSupplierBill('--- Page 1 ---\nInvoice No: INV-1\nPrinted by: Example Printing\n--- Page 2 ---\nGrand Total: PHP 100.00')
  assert.equal(continuation.fields.total, '100.00')
  assert.deepEqual(continuation.evidence.total?.lines, [5])
})

test('standalone date labels and separate exempt-sales amounts preserve the same cautious rules', () => {
  assert.equal(extractSupplierBill('Date\nSeptember 17, 2026').fields.date, '2026-09-17')
  const mixed = extractSupplierBill('VATable Sales\nPHP 1000.00\nVAT Exempt Sales\nPHP 500.00\nVAT\nPHP 120.00\nGrand Total\nPHP 1620.00')
  assert.equal(mixed.fields.netAmount, undefined)
  assert.equal(mixed.fields.vatAmount, '120.00')
  assert.equal(mixed.fields.total, '1620.00')
})

test('buyer and printer identities are excluded even if they are the only valid TINs in the document', () => {
  const result = extractSupplierBill(`SALES INVOICE
Sold To: Real Customer Inc.
TIN: 987-654-321
Address: 12 Customer Street, Quezon City
Description Quantity Amount
Consulting 1 PHP 100.00
Grand Total: PHP 100.00
Printed by: Example Printer Inc.
TIN: 555-666-777
Invoice No: PRINT-123`)
  assert.equal(result.fields.vendorTin, undefined)
  assert.equal(result.fields.vendorName, undefined)
  assert.equal(result.fields.vendorAddress, undefined)
  assert.equal(result.fields.reference, undefined)
  assert.equal(result.fields.description, 'Consulting 1 PHP 100.00')
  assert.equal(result.fields.total, '100.00')
})

test('unlabeled or invalid TINs never become vendor identities', () => {
  for (const raw of ['123-456-789', 'TIN: 000-000-000', 'TIN: 123-456-789-1234', 'TIN: 123-456-789012345']) {
    assert.equal(extractSupplierBill(raw).fields.vendorTin, undefined, raw)
  }
  const unclear = extractSupplierBill('Bill To: Customer\nDescription Quantity Amount\nConsulting 1 100.00\nTIN: 123-456-789')
  assert.equal(unclear.fields.vendorTin, undefined)
  assert.match(unclear.warnings.join(' '), /outside an identifiable supplier/)
})

test('missing supplier fields do not consume the next invoice label, and blank address lines are not duplicated', () => {
  const missing = extractSupplierBill('Supplier Name:\nTIN: 123-456-789\nSupplier Address:\nInvoice No: INV-1\nGrand Total: PHP 100.00')
  assert.equal(missing.fields.vendorName, undefined)
  assert.equal(missing.fields.vendorAddress, undefined)
  assert.equal(missing.fields.vendorTin, '123-456-789')
  const spaced = extractSupplierBill('Supplier Address:\n\n123 Example Street\nMakati City')
  assert.equal(spaced.fields.vendorAddress, '123 Example Street, Makati City')
})

test('matching requires an active vendor and exact branch identity when a branch is printed', () => {
  const records = [
    { id: 'customer', kind: 'customer', active: true, tin: '123-456-789-00001' },
    { id: 'archived', kind: 'vendor', active: false, tin: '123-456-789-00001' },
    { id: 'unknown', kind: 'vendor', tin: '123-456-789-00001' },
    { id: 'branch1', kind: 'vendor', active: true, tin: '123-456-789-001' },
    { id: 'branch0', kind: 'vendor', active: true, tin: '123-456-789-00000' },
    { id: 'invalid', kind: 'vendor', active: true, tin: 'bad' },
  ]
  const exact = matchSupplierVendor(extractSupplierBill(standard), records)
  assert.equal(exact.reason, 'tin_exact')
  assert.equal(exact.vendor?.id, 'branch1')
  assert.equal(matchSupplierVendor(extractSupplierBill('Supplier TIN: 123-456-789-002'), records).reason, 'not_found')
  const base = extractSupplierBill('Supplier TIN: 123-456-789')
  assert.equal(matchSupplierVendor(base, records).reason, 'ambiguous')
  assert.equal(matchSupplierVendor(base, records).vendor, undefined)
  const unique = matchSupplierVendor(base, records.filter(record => record.id !== 'branch0'))
  assert.equal(unique.reason, 'tin_base')
  assert.equal(unique.vendor?.id, 'branch1')
  const duplicate = matchSupplierVendor(extractSupplierBill(standard), [...records, { ...records[3], id: 'duplicate' }])
  assert.equal(duplicate.reason, 'ambiguous')
  assert.equal(duplicate.vendor, undefined)
  assert.equal(matchSupplierVendor(extractSupplierBill('Supplier Name: Same Name'), records).reason, 'no_supplier_tin')
})

test('empty, oversized and highly repetitive input is bounded and never returns a partial selected total', () => {
  assert.deepEqual(extractSupplierBill('').fields, {})
  assert.deepEqual(extractSupplierBill('Grand Total: PHP 100.00\n' + 'x'.repeat(500_001)).fields, {})
  assert.deepEqual(extractSupplierBill('Grand Total: PHP 100.00\n' + '\n'.repeat(10_001)).fields, {})
  const repetitive = extractSupplierBill(Array.from({ length: 40 }, () => 'Grand Total: PHP 100.00').join('\n'))
  assert.equal(repetitive.fields.total, undefined)
  assert.equal(repetitive.candidates.total?.length, 30)
  assert.match(repetitive.warnings.join(' '), /Too many total/)
})
