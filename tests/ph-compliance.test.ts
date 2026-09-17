import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateInvoiceTax, DEFAULT_COMPANY_PROFILE, getComplianceChecklist,
  validateCompanyProfile, validateInvoiceTaxTreatment,
} from '../src/lib/ph-compliance.ts'
import type { CompanyProfile, TaxTreatment } from '../src/lib/ph-compliance.ts'

const company = (changes: Partial<CompanyProfile> = {}): CompanyProfile => ({
  ...DEFAULT_COMPANY_PROFILE,
  registeredName: 'Example Corporation', tin: '123-456-789', rdo: '25A',
  registeredAddress: '123 Example Street, Makati City', businessNature: 'Business services',
  invoiceSeries: 'INV-2026', secRegistrationNumber: 'EXAMPLE-SEC-001', ...changes,
})

test('VAT inclusive and exclusive totals use integer centavos and reconcile', () => {
  assert.deepEqual(calculateInvoiceTax(100_000, 'VAT12', false), {
    netCentavos: 100_000, vatCentavos: 12_000, grossCentavos: 112_000, treatment: 'VAT12', inclusive: false,
  })
  assert.deepEqual(calculateInvoiceTax(112_000, 'VAT12', true), {
    netCentavos: 100_000, vatCentavos: 12_000, grossCentavos: 112_000, treatment: 'VAT12', inclusive: true,
  })
  for (const amount of [0, 1, 4, 5, 14, 15, 99, 100, 101, 112, 113, 123456789]) {
    for (const inclusive of [true, false]) {
      const result = calculateInvoiceTax(amount, 'VAT12', inclusive)
      assert.equal(result.netCentavos + result.vatCentavos, result.grossCentavos)
      assert.ok(Number.isSafeInteger(result.vatCentavos))
      assert.equal(inclusive ? result.grossCentavos : result.netCentavos, amount)
    }
  }
})

test('VAT rounds at centavo boundaries, including exact inclusive half-cent ties', () => {
  assert.equal(calculateInvoiceTax(4, 'VAT12', false).vatCentavos, 0)
  assert.equal(calculateInvoiceTax(5, 'VAT12', false).vatCentavos, 1)
  assert.equal(calculateInvoiceTax(13, 'VAT12', true).vatCentavos, 1)
  assert.equal(calculateInvoiceTax(14, 'VAT12', true).vatCentavos, 2)
  assert.equal(calculateInvoiceTax(42, 'VAT12', true).vatCentavos, 5)
})

test('zero-rated, exempt and non-VAT preserve separate treatment labels with no added VAT', () => {
  for (const treatment of ['VAT_ZERO', 'VAT_EXEMPT', 'NON_VAT'] as const) {
    for (const inclusive of [true, false]) {
      assert.deepEqual(calculateInvoiceTax(12_345, treatment, inclusive), {
        netCentavos: 12_345, vatCentavos: 0, grossCentavos: 12_345, treatment, inclusive,
      })
    }
  }
})

test('unsafe, negative and fractional amounts are rejected instead of losing money precision', () => {
  for (const amount of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateInvoiceTax(amount, 'VAT12', true), /safe integer/)
  }
  assert.throws(() => calculateInvoiceTax(Number.MAX_SAFE_INTEGER, 'VAT12', false), /safe centavo limit/)
  const result = calculateInvoiceTax(Number.MAX_SAFE_INTEGER, 'VAT12', true)
  assert.equal(result.netCentavos + result.vatCentavos, Number.MAX_SAFE_INTEGER)
  assert.throws(() => calculateInvoiceTax(100, 'UNKNOWN' as TaxTreatment, false), /Unsupported/)
  assert.throws(() => calculateInvoiceTax(100, 'VAT12', 'false' as unknown as boolean), /includes VAT/)
})

test('seller VAT registration rejects incompatible invoice treatments', () => {
  assert.deepEqual(validateInvoiceTaxTreatment({ vatStatus: 'non_vat' }, 'NON_VAT'), [])
  for (const treatment of ['VAT12', 'VAT_ZERO', 'VAT_EXEMPT'] as const) {
    assert.equal(validateInvoiceTaxTreatment({ vatStatus: 'non_vat' }, treatment).length, 1)
    assert.deepEqual(validateInvoiceTaxTreatment({ vatStatus: 'vat' }, treatment), [])
  }
  assert.equal(validateInvoiceTaxTreatment({ vatStatus: 'vat' }, 'NON_VAT').length, 1)
})

test('a complete company profile is valid but always requires professional review', () => {
  const profile = company()
  const before = structuredClone(profile)
  const result = validateCompanyProfile(profile)
  assert.equal(result.valid, true)
  assert.deepEqual(result.errors, [])
  assert.ok(result.warnings.some(issue => issue.code === 'accountant_review_required'))
  assert.ok(result.warnings.some(issue => issue.code === 'cas_registration_review'))
  assert.deepEqual(profile, before)
  assert.equal(validateCompanyProfile(company({ accountantReviewRequired: false as true })).valid, false)
})

test('profile rejects malformed registration data and unsupported runtime choices', () => {
  for (const changes of [
    { tin: '000-000-000' }, { tin: '12345678900000' }, { branchCode: '0' },
    { rdo: 'district 44' }, { fiscalYearEnd: '2026-12-31' }, { fiscalYearEnd: '02-30' },
    { fiscalYearEnd: '13-01' }, { registeredName: ' ' }, { invoiceSeries: '' },
    { entityType: 'unsupported' }, { vatStatus: 'unknown' }, { code: 'A/B' },
    { withholdingAgent: 'yes' }, { secRegistrationNumber: '' },
  ]) assert.equal(validateCompanyProfile(company(changes as Partial<CompanyProfile>)).valid, false, JSON.stringify(changes))
  assert.equal(validateCompanyProfile(company({ tin: '123456789' })).valid, true)
})

test('individual 8% selection rejects VAT and corporate profiles and retains eligibility review', () => {
  const sole = company({ entityType: 'sole_proprietor', secRegistrationNumber: '', incomeTaxRegime: 'eight_percent' })
  assert.equal(validateCompanyProfile(sole).valid, true)
  assert.ok(validateCompanyProfile(sole).warnings.some(issue => issue.code === 'eight_percent_eligibility_review'))
  assert.equal(validateCompanyProfile({ ...sole, vatStatus: 'vat' }).valid, false)
  assert.equal(validateCompanyProfile(company({ incomeTaxRegime: 'eight_percent' })).valid, false)
  assert.equal(validateCompanyProfile({ ...sole, incomeTaxRegime: 'corporate' }).valid, false)
  assert.equal(validateCompanyProfile(company({ incomeTaxRegime: 'graduated' })).valid, false)
})

test('checklist distinguishes corporations, OPCs, partnerships and sole proprietors', () => {
  const ids = (profile: CompanyProfile) => getComplianceChecklist(profile).map(item => item.id)
  assert.ok(ids(company()).includes('sec-gis'))
  const opc = ids(company({ entityType: 'opc' }))
  assert.ok(opc.includes('sec-financial-statements'))
  assert.ok(opc.includes('sec-opc-officers'))
  assert.ok(!opc.includes('sec-gis'))
  const partnership = ids(company({ entityType: 'partnership' }))
  assert.ok(partnership.includes('sec-partnership'))
  assert.ok(!partnership.includes('sec-gis'))
  assert.ok(!partnership.includes('sec-financial-statements'))
  const sole = ids(company({ entityType: 'sole_proprietor', incomeTaxRegime: 'graduated' }))
  assert.ok(!sole.some(id => id.startsWith('sec-')))
  assert.ok(sole.includes('sss-self-employed'))
})

test('employee and VAT choices select relevant review queues without universal payroll obligations', () => {
  const normal = getComplianceChecklist(company())
  assert.ok(!normal.some(item => ['SSS', 'PhilHealth', 'Pag-IBIG'].includes(item.agency)))
  const employer = getComplianceChecklist(company({ hasEmployees: true, vatStatus: 'vat' }))
  for (const agency of ['SSS', 'PhilHealth', 'Pag-IBIG']) assert.ok(employer.some(item => item.agency === agency))
  assert.ok(employer.some(item => item.id === 'bir-withholding'))
  assert.ok(employer.some(item => item.id === 'bir-vat'))
  assert.ok(!employer.some(item => item.id === 'bir-non-vat'))
  assert.ok(normal.some(item => item.id === 'bir-non-vat'))
})

test('checklist entries preserve review status, unique identifiers and verified government sources', () => {
  const items = getComplianceChecklist(company({ hasEmployees: true, withholdingAgent: true }))
  assert.equal(new Set(items.map(item => item.id)).size, items.length)
  for (const item of items) {
    assert.equal(item.reviewRequired, true)
    assert.ok(item.sources.length > 0)
    for (const source of item.sources) {
      assert.ok(new URL(source.url).hostname.endsWith('.gov.ph'))
      assert.equal(source.checkedOn, '2026-09-17')
    }
    assert.equal('dueDate' in item, false)
    assert.equal('certified' in item, false)
  }
  const first = items[0].sources[0].title
  items[0].sources[0].title = 'Local change'
  assert.equal(getComplianceChecklist(company())[0].sources[0].title, first)
})
