import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { excelBankDate, importBankStatementRows, normalizeBankAmount, normalizeBankDate, parseBankCsv, parseBankStatementText, readBankWorkbook, suggestBankColumnMapping, type BankColumnMapping } from '../src/lib/bank-statement-import.ts'

test('signed bank money supports parentheses, debit/credit suffixes and exact centavos', () => {
  for (const [text, value] of [['PHP 1,234.56', 123456], ['(25.50)', -2550], ['100.01 DR', -10001], ['100 CR', 10000], ['-0.01', -1], ['0', 0]] as const) assert.equal(normalizeBankAmount(text).value, value)
  for (const text of ['1.234,50', '1O0.00', '-100 CR', '+100 DR', '0.001', 'USD 100', '1000000000000000']) assert.equal(normalizeBankAmount(text).value, undefined, text)
})
test('ambiguous statement dates remain unresolved until an explicit order is selected', () => {
  assert.equal(normalizeBankDate('03/04/2026').value, undefined)
  assert.equal(normalizeBankDate('03/04/2026', 'DMY').value, '2026-04-03')
  assert.equal(normalizeBankDate('03/04/2026', 'MDY').value, '2026-03-04')
  assert.equal(normalizeBankDate('31/02/2026', 'DMY').value, undefined)
  assert.equal(normalizeBankDate('September 17, 2026').value, '2026-09-17')
})
test('Excel date systems are supported and fictional 1900 leap day rejected', () => {
  assert.equal(excelBankDate(1).value, '1900-01-01')
  assert.equal(excelBankDate(60).value, undefined)
  assert.equal(excelBankDate(61).value, '1900-03-01')
  assert.equal(excelBankDate(0, true).value, '1904-01-01')
})
test('CSV parser retains quoted newlines, references with leading zero and original row numbers', () => {
  const table = parseBankCsv('\uFEFFDate,Description,Reference,Amount,Balance\r\n2026-09-01,"Transfer, client\nSecond line",0000123,"1,000.00","11,000.00"\r\n2026-09-02,Fee,0000124,-25.00,10975.00', 'bank.csv')
  const mapping = suggestBankColumnMapping(table).mapping as BankColumnMapping
  const rows = importBankStatementRows(table, mapping, { idPrefix: 'import-1' })
  assert.equal(rows.length, 2)
  assert.equal(rows[0].reference, '0000123')
  assert.equal(rows[0].description, 'Transfer, client\nSecond line')
  assert.equal(rows[0].amount, 100000)
  assert.equal(rows[1].amount, -2500)
  assert.equal(rows[1].source.row, 4)
  assert.equal(rows[0].id, 'import-1:0:2')
})
test('semicolon CSV and explicit debit/credit mapping populate signed rows', () => {
  const table = parseBankCsv('Date;Description;Debit;Credit;Balance\n2026-09-01;Deposit;;1,000.00;11,000.00\n2026-09-02;Charge;25.00;;10,975.00', 'bank.csv')
  const rows = importBankStatementRows(table, suggestBankColumnMapping(table).mapping as BankColumnMapping)
  assert.deepEqual(rows.map(row => row.amount), [100000, -2500])
  assert.equal(rows.flatMap(row => row.issues).length, 0)
})
test('CSV errors and unsupported encodings never silently truncate input', () => {
  assert.throws(() => parseBankCsv('Date,Amount\n"2026-09-01,100', 'bad.csv'), /not closed/)
  assert.throws(() => parseBankCsv('Date,Amount\n2026-09-01,"100"oops', 'bad.csv'), /quotation/)
  assert.throws(() => parseBankCsv('Date\u0000,Amount\n2026-09-01,100', 'bad.csv'), /encoding/)
})
test('duplicate matching headers require explicit source-column choice', () => {
  const table = parseBankCsv('Date,Transaction Date,Amount\n2026-09-01,2026-09-02,100', 'bank.csv')
  const result = suggestBankColumnMapping(table)
  assert.equal(result.mapping.date, undefined)
  assert.ok(result.issues.some(issue => issue.field === 'date'))
  assert.throws(() => importBankStatementRows(table, result.mapping as BankColumnMapping), /Map/)
})
test('ambiguous rows retain raw values and collect correction issues', () => {
  const table = parseBankCsv('Date,Description,Debit,Credit,Balance\n03/04/2026,Ambiguous,100,200,1O00\n2026-09-02,Empty,,,1000', 'bank.csv')
  const rows = importBankStatementRows(table, suggestBankColumnMapping(table).mapping as BankColumnMapping)
  assert.equal(rows[0].date, null)
  assert.equal(rows[0].amount, null)
  assert.equal(rows[0].raw.balance, '1O00')
  assert.deepEqual(rows[0].issues.map(issue => issue.code), ['invalid_date', 'both_debit_credit', 'invalid_balance'])
  assert.ok(rows[1].issues.some(issue => issue.code === 'zero_amount'))
})
test('direction columns are explicit and unfamiliar debit/credit codes remain unresolved', () => {
  const table = parseBankCsv('Date,Type,Amount\n2026-09-01,CR,100\n2026-09-02,DR,20\n2026-09-03,UNKNOWN,30', 'bank.csv')
  const rows = importBankStatementRows(table, suggestBankColumnMapping(table).mapping as BankColumnMapping)
  assert.deepEqual(rows.map(row => row.amount), [10000, -2000, null])
})
test('PDF page references and repeated headers survive statement parsing', () => {
  const table = parseBankStatementText('--- Page 1 ---\nCurrency: PHP\nOpening Balance: 1000.00\nDate\tDescription\tDebit\tCredit\tBalance\n2026-09-01\tDeposit\t\t100.00\t1100.00\n--- Page 2 ---\nDate\tDescription\tDebit\tCredit\tBalance\n2026-09-02\tFee\t25.00\t\t1075.00\nClosing Balance: 1075.00', 'bank.pdf')
  const rows = importBankStatementRows(table, suggestBankColumnMapping(table).mapping as BankColumnMapping)
  assert.deepEqual(rows.map(row => row.amount), [10000, -2500])
  assert.deepEqual(rows.map(row => row.source.page), [1, 2])
  assert.equal(table.metadata.openingBalance, '1000.00')
  assert.equal(rows[1].source.text, '2026-09-02\tFee\t25.00\t\t1075.00')
})
test('OCR spacing yields rows; misaligned wrapped content is visibly unresolved', () => {
  const table = parseBankStatementText('--- Page 1 ---\nDate  Description  Amount  Balance\n2026-09-01  Deposit  100.00  1100.00\nWrapped explanation without a date', 'scan.pdf')
  const rows = importBankStatementRows(table, suggestBankColumnMapping(table).mapping as BankColumnMapping)
  assert.equal(rows[0].amount, 10000)
  assert.ok(rows[1].issues.some(issue => issue.code === 'column_count'))
  assert.throws(() => parseBankStatementText('A blank or unreadable scanned page', 'scan.pdf'), /No readable transaction table/)
})
test('non-PHP metadata blocks approval rather than silently converting money', () => {
  const table = parseBankStatementText('Currency: USD\nDate  Description  Amount\n2026-09-01  Deposit  100.00', 'usd.pdf')
  assert.ok(importBankStatementRows(table, suggestBankColumnMapping(table).mapping as BankColumnMapping)[0].issues.some(issue => issue.code === 'unsupported_currency'))
})
test('workbook reader preserves sheet/row evidence, dates, leading-zero references and formula flags', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([['Date', 'Reference', 'Description', 'Amount', 'Balance'], [46266, 123, 'Deposit', 100.25, 1100.25], [46267, 124, 'Fee', -25, 1075.25]])
  sheet.B2.z = '0000000'
  sheet.D3.f = '-25'
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Account')
  const tables = await readBankWorkbook(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }), 'bank.xlsx')
  const rows = importBankStatementRows(tables[0], suggestBankColumnMapping(tables[0]).mapping as BankColumnMapping)
  assert.equal(rows[0].reference, '0000123')
  assert.equal(rows[0].amount, 10025)
  assert.equal(rows[0].source.sheet, 'Account')
  assert.equal(rows[0].source.row, 2)
  assert.ok(rows[0].date?.startsWith('2026-'))
  assert.ok(rows[1].issues.some(issue => issue.code === 'formula_cell'))
})
test('workbook numeric precision cannot be hidden by rounded display formatting', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([['Date', 'Amount'], ['2026-09-01', 1.001]])
  sheet.B2.z = '0.00'
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Bank')
  const [table] = await readBankWorkbook(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }), 'bank.xlsx')
  const [row] = importBankStatementRows(table, suggestBankColumnMapping(table).mapping as BankColumnMapping)
  assert.equal(row.amount, null)
  assert.equal(row.raw.amount, '1.001')
})
test('invalid and legacy spreadsheet bytes have a clear correction path', async () => {
  await assert.rejects(readBankWorkbook(new TextEncoder().encode('not an excel file').buffer, 'bad.xlsx'), /original XLSX/)
})
