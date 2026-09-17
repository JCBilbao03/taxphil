const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const engine = require('../lib/payroll-statutory.js')
const reviewNote = 'Payroll reviewer checked ordinary scope, monthly bases, official assessments and period allocation.'
const monthly = extra => ({ contributionMonth: '2026-08', scope: 'ordinary_private_employee_full_month', basesReviewed: true, reviewNote, sssMonthlyCompensation: 3000000, philhealthMonthlyBasicSalary: 3000000, pagibigMonthlyFundSalary: 3000000, ...extra })
const withholding = extra => ({ payDate: '2026-08-31', frequency: 'monthly', scope: 'regular_single_employer_period', basesReviewed: true, reviewNote, taxableCompensation: 2800000, ...extra })

test('statutory browser and server helpers remain identical and preserve provenance', () => {
  assert.equal(readFileSync('src/lib/payroll-statutory.ts', 'utf8'), readFileSync('functions/src/payroll-statutory.ts', 'utf8'))
  const result = engine.suggestMonthlyContributions(monthly())
  assert.equal(result.verifiedOn, '2026-09-17')
  assert.equal(result.reviewRequired, true)
  assert.equal(result.periodBasis, 'calendar_month')
  assert.equal(result.sources.every(source => new URL(source.url).hostname.endsWith('.gov.ph')), true)
  assert.match(result.warnings.join(' '), /not a per-cutoff/)
})
test('SSS official salary-band endpoints, minimum, maximum, MPF and EC are literal table amounts', () => {
  const cases = [
    [100, 500000, 25000, 50000, 1000, 0],
    [524999, 500000, 25000, 50000, 1000, 0],
    [525000, 550000, 27500, 55000, 1000, 0],
    [1474999, 1450000, 72500, 145000, 1000, 0],
    [1475000, 1500000, 75000, 150000, 3000, 0],
    [2024999, 2000000, 100000, 200000, 3000, 0],
    [2025000, 2050000, 102500, 205000, 3000, 50000],
    [3474999, 3450000, 172500, 345000, 3000, 1450000],
    [3475000, 3500000, 175000, 350000, 3000, 1500000],
    [1e10, 3500000, 175000, 350000, 3000, 1500000],
  ]
  for (const [salary, msc, employee, employer, ec, provident] of cases) {
    const result = engine.suggestMonthlyContributions(monthly({ sssMonthlyCompensation: salary })).sss
    assert.deepEqual([result.monthlySalaryCredit, result.employee, result.employer, result.ecEmployer, result.providentSalaryCredit], [msc, employee, employer, ec, provident], `salary ${salary}`)
    assert.equal(result.employee, result.regularEmployee + result.providentEmployee)
    assert.equal(result.employer, result.regularEmployer + result.providentEmployer)
    assert.equal(result.totalRemittance, employee + employer + ec)
  }
})
test('PhilHealth fixed basic salary floor, ceiling and equal shares do not use the other bases', () => {
  const cases = [[500000, 1000000, 25000], [1000000, 1000000, 25000], [3000000, 3000000, 75000], [10000000, 10000000, 250000], [20000000, 10000000, 250000]]
  for (const [salary, base, share] of cases) {
    const result = engine.suggestMonthlyContributions(monthly({ philhealthMonthlyBasicSalary: salary })).philhealth
    assert.deepEqual([result.cappedBasicSalary, result.employee, result.employer, result.premium], [base, share, share, share * 2])
  }
  const result = engine.suggestMonthlyContributions(monthly({ philhealthMonthlyBasicSalary: 1000020 }))
  assert.equal(result.philhealth.employee, 25001)
  assert.equal(result.philhealth.roundingDifference, 1)
  assert.match(result.warnings.join(' '), /one centavo/)
})
test('Pag-IBIG uses fund salary rate boundary and maximum fund salary, including lower salaries', () => {
  const cases = [[100000, 100000, 1, 1000, 2000], [150000, 150000, 1, 1500, 3000], [150001, 150001, 2, 3000, 3000], [999999, 999999, 2, 20000, 20000], [1000000, 1000000, 2, 20000, 20000], [9000000, 1000000, 2, 20000, 20000]]
  for (const [salary, base, rate, employee, employer] of cases) {
    const result = engine.suggestMonthlyContributions(monthly({ pagibigMonthlyFundSalary: salary })).pagibig
    assert.deepEqual([result.cappedFundSalary, result.employeeRatePercent, result.employee, result.employer], [base, rate, employee, employer])
  }
})
test('monthly suggestions cannot guess special classes, zero pay or incomplete review', () => {
  for (const scope of ['kasambahay', 'government', 'self_employed', 'partial_month', 'multiple_employers', '', undefined]) assert.throws(() => engine.suggestMonthlyContributions(monthly({ scope })), /manual review/)
  for (const base of ['sssMonthlyCompensation', 'philhealthMonthlyBasicSalary', 'pagibigMonthlyFundSalary']) {
    for (const value of [0, -1, 1.1, NaN, Infinity, '10000', 1e10 + 1]) assert.throws(() => engine.suggestMonthlyContributions(monthly({ [base]: value })), /centavos/)
  }
  assert.throws(() => engine.suggestMonthlyContributions(monthly({ basesReviewed: false })), /Confirm/)
  assert.throws(() => engine.suggestMonthlyContributions(monthly({ reviewNote: 'ok' })), /review note/)
  for (const month of ['2025-08', '2026-13', '2026-00', '2026-10', '2026-09-01']) assert.throws(() => engine.suggestMonthlyContributions(monthly({ contributionMonth: month })), /2026 contribution month/)
})
test('BIR monthly and semi-monthly use the published constants at every bracket, not annual-table conversions', () => {
  const cases = {
    monthly: [[0, 0], [2083300, 0], [2800000, 107505], [3333300, 187500], [6666700, 854180], [16666700, 3354180], [66666700, 18354180]],
    semi_monthly: [[1041700, 0], [1400000, 53745], [1666700, 93750], [3333300, 427070], [8333300, 1677070], [33333300, 9177070]],
    weekly: [[480800, 0], [600000, 17880], [769200, 43260], [1538500, 197120], [3846200, 774045], [15384600, 4235565]],
    daily: [[68500, 0], [80000, 1725], [109600, 6165], [219200, 28085], [547900, 110260]],
  }
  for (const [frequency, rows] of Object.entries(cases)) for (const [taxableCompensation, tax] of rows) {
    const result = engine.suggestCompensationWithholding(withholding({ frequency, taxableCompensation }))
    assert.equal(result.withholdingTax, tax, `${frequency} ${taxableCompensation}`)
    assert.equal(result.periodBasis, frequency)
    assert.equal(result.basis.taxableCompensation, taxableCompensation)
  }
})
test('BIR fractional-centavo tax uses deterministic integer half-up rounding', () => {
  assert.equal(engine.suggestCompensationWithholding(withholding({ taxableCompensation: 2083303 })).withholdingTax, 0)
  assert.equal(engine.suggestCompensationWithholding(withholding({ taxableCompensation: 2083310 })).withholdingTax, 2)
  const result = engine.suggestCompensationWithholding(withholding({ taxableCompensation: 10000000000 }))
  assert.equal(Number.isSafeInteger(result.withholdingTax), true)
  assert.equal(result.withholdingTax, 3495020835)
})
test('ambiguous BIR daily top bracket and unsupported tax treatments stop for manual review', () => {
  const allowed = engine.suggestCompensationWithholding(withholding({ frequency: 'daily', taxableCompensation: 2191799 }))
  assert.equal(allowed.ratePercent, 30)
  assert.throws(() => engine.suggestCompensationWithholding(withholding({ frequency: 'daily', taxableCompensation: 2191800 })), /printed ambiguously/)
  for (const scope of ['minimum_wage_exempt', 'supplementary_pay', 'final_pay', 'annual', 'multiple_employers', undefined]) assert.throws(() => engine.suggestCompensationWithholding(withholding({ scope })), /manual review/)
  for (const frequency of ['biweekly', 'annual', 'toString', '__proto__']) assert.throws(() => engine.suggestCompensationWithholding(withholding({ frequency })), /manual review/)
  for (const payDate of ['2025-12-31', '2026-02-30', '2026-09-18', '2027-01-01']) assert.throws(() => engine.suggestCompensationWithholding(withholding({ payDate })), /2026|verification date/)
  assert.throws(() => engine.suggestCompensationWithholding(withholding({ basesReviewed: false })), /Confirm/)
  assert.throws(() => engine.suggestCompensationWithholding(withholding({ taxableCompensation: -1 })), /centavos/)
})
test('calculation inputs are not mutated and monthly amounts cannot include tax or period allocation', () => {
  const input = Object.freeze(monthly()), result = engine.suggestMonthlyContributions(input)
  assert.notEqual(result.basis, input)
  assert.equal('withholdingTax' in result.monthlyAmounts, false)
  assert.equal('netPay' in result, false)
  assert.deepEqual(result.monthlyAmounts, { sssEmployee: 150000, sssEmployer: 300000, ecEmployer: 3000, philhealthEmployee: 75000, philhealthEmployer: 75000, pagibigEmployee: 20000, pagibigEmployer: 20000 })
})
