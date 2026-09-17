export function normalizePersonalProfile(input: { fullName: string; tin: string; businessName: string }) {
  const fullName = input.fullName.trim(), businessName = input.businessName.trim(), rawTin = input.tin.trim()
  if (!fullName || fullName.length > 120) throw Error('Enter your full name using 1–120 characters.')
  if (businessName.length > 200) throw Error('The business name must be 200 characters or fewer.')
  const digits = rawTin.replace(/[-\s]/g, '')
  if (rawTin && (!/^\d+$/.test(digits) || ![9, 12, 14].includes(digits.length))) throw Error('Enter a 9-digit TIN, optionally followed by your 3- or 5-digit branch code. Hyphens are allowed.')
  const tin = digits ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}${digits.length > 9 ? `-${digits.slice(9)}` : ''}` : ''
  return { fullName, tin, businessName }
}

export const personalTaxpayerTypes = ['Self-employed / Professional', 'Sole proprietor', 'Mixed-income earner', 'Compensation income earner', 'Other / Needs review'] as const

export function normalizePersonalRegistration(input: { taxType: string; rdo: string }) {
  const taxType = input.taxType.trim(), rdo = input.rdo.trim().toUpperCase()
  if (!personalTaxpayerTypes.some(value => value === taxType)) throw Error('Select a taxpayer type for this personal workspace.')
  if (rdo && !/^\d{1,3}[A-Z]?$/.test(rdo)) throw Error('Enter your RDO code, such as 039 or 008A, as shown on your registration.')
  return { taxType, rdo }
}
