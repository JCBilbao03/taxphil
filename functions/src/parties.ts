export type PartyKind = 'vendor' | 'customer'
export interface PartyInput {
  kind: PartyKind
  registeredName: string
  tin: string
  address: string
  email: string
  defaultAtc: string
  notes: string
  active: boolean
}
export interface Party extends PartyInput {
  id: string
  normalizedTin: string
  version: number
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

function bounded(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`${label} ${required ? 'is required and' : ''} must be ${max} characters or fewer.`)
  return value.trim()
}

/** Syntactic normalization only; this does not verify registration with the BIR. */
export function normalizePartyTin(value: unknown): string {
  if (typeof value !== 'string' || !/^[\d\s-]+$/.test(value)) throw new Error('Enter a 9-digit TIN with an optional 3- or 5-digit branch code.')
  const digits = value.replace(/[\s-]/g, '')
  if (![9, 12, 14].includes(digits.length) || /^0{9}/.test(digits)) throw new Error('Enter a 9-digit TIN with an optional 3- or 5-digit branch code.')
  return digits.slice(0, 9) + digits.slice(9).padStart(5, '0')
}

export function formatPartyTin(normalized: string): string {
  if (!/^\d{14}$/.test(normalized)) throw new Error('Invalid normalized TIN.')
  return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6, 9)}-${normalized.slice(9)}`
}

export function validateParty(input: unknown): PartyInput & { normalizedTin: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Vendor or customer details are required.')
  const value = input as Record<string, unknown>
  if (value.kind !== 'vendor' && value.kind !== 'customer') throw new Error('Choose a vendor or customer record.')
  if (typeof value.active !== 'boolean') throw new Error('Choose an active or archived status.')
  const normalizedTin = normalizePartyTin(value.tin)
  const email = bounded(value.email, 'Email', 320).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email or leave it empty.')
  const defaultAtc = bounded(value.defaultAtc, 'Default ATC', 5).toUpperCase()
  if (defaultAtc && !/^[A-Z]{2}\d{3}$/.test(defaultAtc)) throw new Error('Enter an ATC such as WC010, or leave it empty for review per transaction.')
  return {
    kind: value.kind, registeredName: bounded(value.registeredName, 'Registered name', 200, true),
    tin: formatPartyTin(normalizedTin), normalizedTin, address: bounded(value.address, 'Registered address', 500, true),
    email, defaultAtc, notes: bounded(value.notes, 'Notes', 2000), active: value.active,
  }
}

export function partyInvoiceSnapshot(party: Party, kind: 'payable' | 'receivable') {
  if (!party.active || party.kind !== (kind === 'payable' ? 'vendor' : 'customer')) throw new Error(`Select an active ${kind === 'payable' ? 'vendor' : 'customer'} from your company directory.`)
  const clean = validateParty(party)
  return { partyId: party.id, party: clean.registeredName, partyTin: clean.tin, partyAddress: clean.address }
}
