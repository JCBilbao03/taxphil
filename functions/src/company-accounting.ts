import { createHash, randomBytes } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, type DocumentData, type Transaction } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
import { addAccount, addInvoice, appendSettlementDocuments, closePeriod, emptyBooks, post, reverse, settle, type Account, type Books, type Invoice, type Line, type SettlementSupportingDocument } from './accounting-engine.js'
import { validateCompanyProfile, type CompanyProfile } from './ph-compliance.js'
import { supplierBillPdfValue, verifySupplierBillPdf } from './supplier-bill-storage.js'
import { settlementDocumentsValue, verifySettlementDocuments } from './settlement-storage.js'

// Company books are server-owned. Never trust a company ID, role, tax calculation,
// source type, or ledger snapshot supplied by a browser.
type Role = 'admin' | 'manager' | 'accountant' | 'viewer'
type Identity = { uid: string; email: string; displayName: string }
type Member = Identity & { companyId: string; companyCode: string; role: Role; active: boolean; joinedAt: string; updatedAt: string }
type Input = Record<string, unknown>
type Command = { type: string; input: Input }
const roles: Role[] = ['admin', 'manager', 'accountant', 'viewer']
const options = { region: 'asia-southeast1', timeoutSeconds: 30, maxInstances: 20 }
const iso = () => new Date().toISOString()
const failure = (message: string): never => { throw new HttpsError('invalid-argument', message) }
const record = (value: unknown): Input => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return failure('A valid request object is required.')
  return value as Input
}
const string = (value: unknown, label: string, max = 200, optional = false): string => {
  if (optional && (value === undefined || value === '')) return ''
  if (typeof value !== 'string' || !value.trim() || value.length > max) return failure(`${label} is required (maximum ${max} characters).`)
  return value.trim()
}
const integer = (value: unknown, label: string, min = 0, max = 1e12): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return failure(`${label} must be a valid whole number.`)
  return value
}
const roleValue = (value: unknown): Role => {
  if (!roles.includes(value as Role)) return failure('Choose an existing company role.')
  return value as Role
}
const boolean = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') return failure(`${label} must be true or false.`)
  return value
}
const id = (value: unknown, label: string): string => {
  const result = string(value, label, 128)
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) return failure(`${label} is invalid.`)
  return result
}
const emailValue = (value: unknown): string => {
  const email = string(value, 'Email', 320).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return failure('Enter a valid email address.')
  return email
}

async function identity(request: CallableRequest): Promise<Identity> {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.')
  // Read the current Auth user as well as the token: disabled users and old
  // tokens issued before an email change must not retain company access.
  const user = await getAuth().getUser(request.auth.uid)
  if (user.disabled || !user.emailVerified || !user.email || request.auth.token.email_verified !== true || request.auth.token.email !== user.email) {
    throw new HttpsError('permission-denied', 'Verify your email and sign in again to access company records.')
  }
  return { uid: user.uid, email: user.email.toLowerCase(), displayName: (user.displayName || user.email).slice(0, 120) }
}

function profileValue(value: unknown): CompanyProfile {
  const p = record(value)
  const clean: CompanyProfile = {
    registeredName: string(p.registeredName, 'Registered business name'),
    tin: string(p.tin, 'TIN', 20), branchCode: string(p.branchCode, 'Branch code', 5),
    rdo: string(p.rdo, 'RDO', 4), registeredAddress: string(p.registeredAddress, 'Registered address', 500),
    entityType: string(p.entityType, 'Entity type', 30) as CompanyProfile['entityType'],
    vatStatus: string(p.vatStatus, 'VAT registration', 20) as CompanyProfile['vatStatus'],
    incomeTaxRegime: string(p.incomeTaxRegime, 'Income tax regime', 30) as CompanyProfile['incomeTaxRegime'],
    fiscalYearEnd: string(p.fiscalYearEnd, 'Fiscal year end', 5),
    reportingFramework: string(p.reportingFramework, 'Reporting framework', 20) as CompanyProfile['reportingFramework'],
    withholdingAgent: boolean(p.withholdingAgent, 'Withholding agent'), hasEmployees: boolean(p.hasEmployees, 'Employees'),
    casRegistrationReference: string(p.casRegistrationReference, 'CAS registration reference', 200, true),
    invoiceSeries: string(p.invoiceSeries, 'Invoice series', 80),
    secRegistrationNumber: string(p.secRegistrationNumber, 'SEC registration number', 100, true),
    businessNature: string(p.businessNature, 'Business nature', 300), accountantReviewRequired: true,
  }
  const result = validateCompanyProfile(clean)
  if (!result.valid) throw new HttpsError('invalid-argument', result.errors.map(error => error.message).join(' '))
  return clean
}

async function context(tx: Transaction, actor: Identity) {
  const db = getFirestore()
  const membershipRef = db.doc(`companyMemberships/${actor.uid}`)
  const membership = await tx.get(membershipRef)
  const member = membership.data() as Member | undefined
  if (!member || !member.active || !roles.includes(member.role) || !/^[a-zA-Z0-9_-]+$/.test(member.companyId)) {
    throw new HttpsError('permission-denied', 'An active company membership is required.')
  }
  const companyRef = db.doc(`companies/${member.companyId}`)
  const memberRef = companyRef.collection('members').doc(actor.uid)
  const [company, companyMember] = await tx.getAll(companyRef, memberRef)
  if (!company.exists || !companyMember.exists || companyMember.get('active') !== true || companyMember.get('role') !== member.role) {
    throw new HttpsError('permission-denied', 'Your company membership is no longer active.')
  }
  return { member, companyRef, company: company.data()!, membershipRef, memberRef }
}

export { identity as companyIdentity, context as companyContext, audit as companyAudit, requireRole as companyRequireRole }
function requireRole(member: Member, allowed: Role[]) {
  if (!allowed.includes(member.role)) throw new HttpsError('permission-denied', 'Your role does not allow this action.')
}
function audit(tx: Transaction, companyRef: FirebaseFirestore.DocumentReference, actor: Identity, action: string, summary: string, extra: Input = {}) {
  tx.create(companyRef.collection('audit').doc(), { actorUid: actor.uid, actorEmail: actor.email, action, summary, createdAt: iso(), ...extra })
}

export const companyCreate = onCall(options, async request => {
  const actor = await identity(request)
  const profile = profileValue(record(request.data).profile)
  const db = getFirestore()
  const companyRef = db.collection('companies').doc()
  const companyCode = `PH-${randomBytes(5).toString('hex').toUpperCase()}`
  const codeRef = db.doc(`companyCodes/${companyCode}`)
  const membershipRef = db.doc(`companyMemberships/${actor.uid}`)
  return db.runTransaction(async tx => {
    const [membership, code] = await tx.getAll(membershipRef, codeRef)
    if (membership.exists) throw new HttpsError('already-exists', 'Your account already belongs to a company. Contact its administrator.')
    if (code.exists) throw new HttpsError('aborted', 'Please retry creating the company.')
    const now = iso()
    const member: Member = { ...actor, companyId: companyRef.id, companyCode, role: 'admin', active: true, joinedAt: now, updatedAt: now }
    tx.create(codeRef, { companyId: companyRef.id })
    tx.create(companyRef, { profile, companyCode, code: companyCode, name: profile.registeredName, adminCount: 1, createdAt: now, updatedAt: now, createdBy: actor.uid })
    tx.create(membershipRef, member)
    tx.create(companyRef.collection('members').doc(actor.uid), member)
    tx.create(companyRef.collection('accounting').doc('books'), { books: emptyBooks(), revision: 0, pendingCount: 0, updatedAt: now })
    audit(tx, companyRef, actor, 'company.create', 'Created company and assigned its first administrator.')
    return { companyId: companyRef.id, companyCode, role: 'admin', revision: 0 }
  })
})

export const companyInvite = onCall(options, async request => {
  const actor = await identity(request)
  const data = record(request.data)
  const email = emailValue(data.email)
  const role = roleValue(data.role)
  const inviteCode = randomBytes(24).toString('base64url')
  const hash = createHash('sha256').update(inviteCode).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  return getFirestore().runTransaction(async tx => {
    const c = await context(tx, actor)
    requireRole(c.member, ['admin'])
    tx.create(c.companyRef.collection('invitations').doc(hash), { email, role, createdBy: actor.uid, createdAt: iso(), expiresAt, status: 'pending' })
    audit(tx, c.companyRef, actor, 'member.invite', `Created a ${role} invitation for ${email}.`)
    return { companyCode: c.member.companyCode, inviteCode, expiresAt }
  })
})

export const companyJoin = onCall(options, async request => {
  const actor = await identity(request)
  const data = record(request.data)
  const companyCode = string(data.companyCode, 'Company code', 30).toUpperCase()
  if (!/^PH-[A-F0-9]{10}$/.test(companyCode)) return failure('Enter a valid company code.')
  const inviteCode = string(data.inviteCode, 'Invitation code', 100)
  const hash = createHash('sha256').update(inviteCode).digest('hex')
  const db = getFirestore()
  return db.runTransaction(async tx => {
    const membershipRef = db.doc(`companyMemberships/${actor.uid}`)
    const [existing, code] = await tx.getAll(membershipRef, db.doc(`companyCodes/${companyCode}`))
    if (existing.exists) throw new HttpsError('already-exists', 'Your account already belongs to a company. Contact its administrator.')
    if (!code.exists) throw new HttpsError('permission-denied', 'The company or invitation code is invalid or expired.')
    const companyRef = db.doc(`companies/${code.get('companyId')}`)
    const inviteRef = companyRef.collection('invitations').doc(hash)
    const [company, invite] = await tx.getAll(companyRef, inviteRef)
    const invitation = invite.data()
    if (!company.exists || !invitation || invitation.email !== actor.email || invitation.status !== 'pending' || typeof invitation.expiresAt !== 'string' || invitation.expiresAt <= iso() || !roles.includes(invitation.role)) {
      throw new HttpsError('permission-denied', 'The company or invitation code is invalid, expired, or intended for a different email.')
    }
    const now = iso()
    const member: Member = { ...actor, companyId: companyRef.id, companyCode, role: invitation.role as Role, active: true, joinedAt: now, updatedAt: now }
    tx.create(membershipRef, member)
    tx.create(companyRef.collection('members').doc(actor.uid), member)
    tx.update(inviteRef, { status: 'accepted', acceptedBy: actor.uid, acceptedAt: now })
    tx.update(companyRef, { updatedAt: now, ...(member.role === 'admin' ? { adminCount: integer(company.get('adminCount'), 'Administrator count', 1) + 1 } : {}) })
    audit(tx, companyRef, actor, 'member.join', `${actor.email} joined as ${member.role}.`, { invitedBy: invitation.createdBy })
    return { companyId: companyRef.id, companyCode, role: member.role }
  })
})

export const companySetMemberRole = onCall(options, async request => {
  const actor = await identity(request)
  const data = record(request.data)
  const uid = id(data.uid, 'User ID')
  const role = roleValue(data.role)
  const active = boolean(data.active, 'Active membership')
  if (uid === actor.uid && (!active || role !== 'admin')) throw new HttpsError('failed-precondition', 'Another administrator must change your access.')
  return getFirestore().runTransaction(async tx => {
    const c = await context(tx, actor)
    requireRole(c.member, ['admin'])
    const targetMembershipRef = getFirestore().doc(`companyMemberships/${uid}`)
    const targetMemberRef = c.companyRef.collection('members').doc(uid)
    const [membership, member] = await tx.getAll(targetMembershipRef, targetMemberRef)
    if (!membership.exists || !member.exists || membership.get('companyId') !== c.companyRef.id) throw new HttpsError('not-found', 'Company member not found.')
    const wasAdmin = membership.get('active') === true && membership.get('role') === 'admin'
    const isAdmin = active && role === 'admin'
    const adminCount = integer(c.company.adminCount, 'Administrator count', 1) + Number(isAdmin) - Number(wasAdmin)
    if (adminCount < 1) throw new HttpsError('failed-precondition', 'The company must retain at least one active administrator.')
    const updatedAt = iso()
    tx.update(targetMembershipRef, { role, active, updatedAt })
    tx.update(targetMemberRef, { role, active, updatedAt })
    tx.update(c.companyRef, { adminCount, updatedAt })
    audit(tx, c.companyRef, actor, 'member.access', `Set ${member.get('email')} to ${role}; access ${active ? 'active' : 'disabled'}.`, { targetUid: uid, previousRole: membership.get('role'), previousActive: membership.get('active'), role, active })
    return { uid, role, active }
  })
})

export const companyUpdateProfile = onCall(options, async request => {
  const actor = await identity(request)
  const profile = profileValue(record(request.data).profile)
  return getFirestore().runTransaction(async tx => {
    const c = await context(tx, actor)
    requireRole(c.member, ['admin'])
    tx.update(c.companyRef, { profile, name: profile.registeredName, updatedAt: iso() })
    audit(tx, c.companyRef, actor, 'company.profile', 'Updated the company’s registered business and tax settings.', { previousProfile: c.company.profile, profile })
    return { profile }
  })
})

function commandValue(value: unknown): Command {
  const command = record(value)
  const type = string(command.type, 'Command type', 30)
  if (type === 'restore') throw new HttpsError('permission-denied', 'Shared company books cannot be replaced with a browser backup. Use traceable adjusting or reversing entries.')
  if (!['post', 'addInvoice', 'settle', 'attachSettlementDocuments', 'reverse', 'addAccount', 'closePeriod', 'approve', 'reject'].includes(type)) return failure('Unknown accounting command.')
  const input = command.input === undefined ? command : record(command.input)
  if (type === 'post') {
    if (input.source !== undefined && input.source !== 'journal') return failure('Use the specific invoice, payment, or reversal action instead of supplying a ledger source.')
    if (input.reversalOf !== undefined) return failure('Use the reversal action to reverse an entry.')
    if (!Array.isArray(input.lines) || input.lines.length < 2 || input.lines.length > 100) return failure('Use 2–100 journal lines.')
    const lines: Line[] = input.lines.map(value => { const line = record(value); return { account: string(line.account, 'Account code', 8), debit: integer(line.debit, 'Debit'), credit: integer(line.credit, 'Credit') } })
    return { type, input: { date: string(input.date, 'Date', 10), reference: string(input.reference, 'Reference'), description: string(input.description, 'Description', 500), lines, source: 'journal' } }
  }
  if (type === 'addInvoice') {
    if (!['payable', 'receivable'].includes(input.kind as string)) return failure('Choose a valid invoice type.')
    if (!['VAT12', 'VAT_ZERO', 'VAT_EXEMPT', 'NON_VAT'].includes(input.taxTreatment as string)) return failure('Choose the invoice’s tax treatment.')
    const supplierBillPdf = input.supplierBillPdf === undefined ? undefined : supplierBillPdfValue(input.supplierBillPdf, input.kind)
    return { type, input: { kind: input.kind, partyId: id(input.partyId, 'Saved vendor or customer'), party: string(input.party, 'Customer or supplier'), reference: string(input.reference, 'Invoice reference', 197), date: string(input.date, 'Date', 10), due: string(input.due, 'Due date', 10), amount: integer(input.amount, 'Invoice amount', 1), account: string(input.account, 'Account code', 8), taxTreatment: input.taxTreatment, partyTin: string(input.partyTin, 'Customer or supplier TIN', 20, true), partyAddress: string(input.partyAddress, 'Customer or supplier address', 500, true), description: string(input.description, 'Description', 500, true), ...(supplierBillPdf ? { supplierBillPdf } : {}) } }
  }
  if (type === 'settle') {
    const supportingDocuments = input.supportingDocuments === undefined ? undefined : settlementDocumentsValue(input.supportingDocuments)
    return { type, input: { invoiceId: id(input.invoiceId, 'Invoice ID'), amount: integer(input.amount, 'Payment amount', 1), date: string(input.date, 'Payment date', 10), cash: string(input.cash, 'Cash or bank account', 8), reference: string(input.reference, 'Payment reference'), ...(supportingDocuments === undefined ? {} : { supportingDocuments }) } }
  }
  if (type === 'attachSettlementDocuments') {
    const supportingDocuments = settlementDocumentsValue(input.supportingDocuments)
    if (!supportingDocuments.length) return failure('Select at least one new supporting document.')
    return { type, input: { settlementId: id(input.settlementId, 'Payment or receipt ID'), supportingDocuments } }
  }
  if (type === 'reverse') return { type, input: { entryId: id(input.entryId, 'Entry ID'), date: string(input.date, 'Reversal date', 10) } }
  if (type === 'addAccount') return { type, input: { code: string(input.code, 'Account code', 8), name: string(input.name, 'Account name'), type: string(input.type, 'Account type', 20), cash: boolean(input.cash, 'Cash account') } }
  if (type === 'closePeriod') return { type, input: { date: string(input.date, 'Close date', 10) } }
  return { type, input: { pendingId: id(input.pendingId, 'Approval ID'), reason: string(input.reason, 'Decision reason', 500, true) } }
}

function apply(books: Books, command: Command, profile: CompanyProfile): Books {
  const i = command.input
  try {
    switch (command.type) {
      case 'post': return post(books, i as unknown as Parameters<typeof post>[1])
      case 'addInvoice': {
        if (profile.vatStatus === 'non_vat' && i.taxTreatment === 'VAT12') throw Error('A non-VAT company cannot charge output VAT or claim input VAT. Record non-creditable purchase VAT in the gross expense using NON_VAT.')
        if (i.kind === 'receivable' && ((profile.vatStatus === 'vat' && i.taxTreatment === 'NON_VAT') || (profile.vatStatus === 'non_vat' && i.taxTreatment !== 'NON_VAT'))) throw Error('The sales tax treatment must match your company VAT registration. Review the tax profile first.')
        return addInvoice(books, i as unknown as Omit<Invoice, 'id' | 'entryId'>)
      }
      case 'settle': return settle(books, i.invoiceId as string, i.amount as number, i.date as string, i.cash as string, i.reference as string, i.supportingDocuments as SettlementSupportingDocument[] | undefined)
      case 'attachSettlementDocuments': return appendSettlementDocuments(books, i.settlementId as string, i.supportingDocuments as SettlementSupportingDocument[])
      case 'reverse': return reverse(books, i.entryId as string, i.date as string)
      case 'addAccount': return addAccount(books, i as unknown as Account)
      case 'closePeriod': return closePeriod(books, i.date as string)
      default: return failure('This command cannot be posted to the ledger.')
    }
  } catch (error) {
    if (error instanceof HttpsError) throw error
    throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'The accounting record could not be validated.')
  }
}
function summary(command: Command): string {
  const i = command.input
  if (command.type === 'addInvoice') return `${i.kind === 'payable' ? 'Bill' : 'Invoice'} ${i.reference} · ${i.party}`
  if (command.type === 'post') return `Journal ${i.reference} · ${i.description}`.slice(0, 500)
  if (command.type === 'settle') return `Recorded settlement ${i.reference}`
  if (command.type === 'attachSettlementDocuments') return `Added supporting documents to payment or receipt ${i.settlementId}`
  if (command.type === 'reverse') return `Reversed entry ${i.entryId}`
  if (command.type === 'addAccount') return `Added account ${i.code} · ${i.name}`
  if (command.type === 'closePeriod') return `Closed books through ${i.date}`
  return `${command.type} ${i.pendingId}`
}

async function resolveParty(tx:Transaction,companyRef:FirebaseFirestore.DocumentReference,command:Command,preserveSnapshot=false) {
  if(command.type!=='addInvoice')return
  const party=await tx.get(companyRef.collection('parties').doc(command.input.partyId as string))
  if(!party.exists||party.get('active')!==true||party.get('kind')!==(command.input.kind==='payable'?'vendor':'customer'))throw new HttpsError('failed-precondition','Select an active vendor or customer from this company before posting.')
  if(preserveSnapshot){
    if(command.input.party!==party.get('registeredName')||command.input.partyTin!==party.get('tin')||command.input.partyAddress!==party.get('address'))throw new HttpsError('failed-precondition','The vendor or customer details changed after preparation. Reject this draft and prepare it again with the current details.')
  }else{command.input.party=party.get('registeredName');command.input.partyTin=party.get('tin');command.input.partyAddress=party.get('address')}
}

export const companyAccountingCommand = onCall(options, async request => {
  const actor = await identity(request)
  const data = record(request.data)
  const command = commandValue(data.command)
  const expectedRevision = integer(data.expectedRevision, 'Books revision')
  return getFirestore().runTransaction(async tx => {
    const c = await context(tx, actor)
    requireRole(c.member, ['admin', 'manager', 'accountant'])
    if (c.member.role === 'accountant' && !['post', 'addInvoice'].includes(command.type)) throw new HttpsError('permission-denied', 'Accountants may prepare bills, invoices, and journals for approval. A manager or administrator must perform this action.')
    const booksRef = c.companyRef.collection('accounting').doc('books')
    const snapshot = await tx.get(booksRef)
    if (!snapshot.exists) throw new HttpsError('failed-precondition', 'Company books have not been initialized.')
    const current = snapshot.data()!
    if (current.revision !== expectedRevision) throw new HttpsError('aborted', 'The books changed while you were working. Refresh the records and try again.')
    await resolveParty(tx,c.companyRef,command)
    await verifySupplierBillPdf(command, c.companyRef.id)
    let books = current.books as Books
    await verifySettlementDocuments(command, books, c.companyRef.id)
    let pendingCount = typeof current.pendingCount === 'number' ? current.pendingCount : 0
    let status: 'posted' | 'pending' | 'approved' | 'rejected' = 'posted'
    let pendingId: string | undefined
    let preparedBy: string | undefined
    let actionSummary = summary(command)
    let approvedCommand: Command | undefined
    let approval: DocumentData | undefined
    const decisionRef = ['approve', 'reject'].includes(command.type) ? c.companyRef.collection('approvals').doc(command.input.pendingId as string) : undefined
    if (decisionRef) {
      approval = (await tx.get(decisionRef)).data()
      if (!approval || approval.status !== 'pending') throw new HttpsError('failed-precondition', 'This record is no longer awaiting approval.')
      if (command.type === 'approve' && approval.preparedBy === actor.uid) throw new HttpsError('permission-denied', 'You cannot approve a transaction you prepared. Ask another manager or administrator.')
      approvedCommand = commandValue(approval.command)
      if (!['post', 'addInvoice'].includes(approvedCommand.type)) throw new HttpsError('failed-precondition', 'Invalid approval record.')
      preparedBy = approval.preparedBy as string
      pendingId = decisionRef.id
      status = command.type === 'approve' ? 'approved' : 'rejected'
      actionSummary = `${status === 'approved' ? 'Approved' : 'Rejected'}: ${summary(approvedCommand)}`
      if (status === 'approved') {
        await resolveParty(tx, c.companyRef, approvedCommand, true)
        await verifySupplierBillPdf(approvedCommand, c.companyRef.id)
        books = apply(books, approvedCommand, c.company.profile as CompanyProfile)
      }
      pendingCount = Math.max(0, pendingCount - 1)
    } else if (c.member.role === 'accountant') {
      // Validate now, then revalidate against the current books on approval.
      apply(books, command, c.company.profile as CompanyProfile)
      if (pendingCount >= 100) throw new HttpsError('resource-exhausted', 'Review the company’s pending transactions before preparing more.')
      status = 'pending'
      pendingCount++
      pendingId = c.companyRef.collection('approvals').doc().id
    } else {
      books = apply(books, command, c.company.profile as CompanyProfile)
    }
    // Stay below Firestore's 1 MiB document limit. This first release uses one
    // atomic books document; a partitioned ledger is required before expansion.
    if (Buffer.byteLength(JSON.stringify(books), 'utf8') > 650_000 || books.entries.length > 2000 || books.accounts.length > 500) {
      throw new HttpsError('resource-exhausted', 'These company books have reached this release’s capacity. Export your records and arrange a ledger capacity upgrade before adding more entries.')
    }
    const now = iso()
    const revision = expectedRevision + 1
    if (decisionRef && approval) tx.update(decisionRef, { status, decidedBy: actor.uid, decidedByEmail: actor.email, decidedAt: now, reason: command.input.reason, postedRevision: revision })
    if (status === 'pending' && pendingId) tx.create(c.companyRef.collection('approvals').doc(pendingId), { command, status, preparedBy: actor.uid, createdBy: actor.uid, preparedByEmail: actor.email, preparedAt: now, createdAt: now, summary: actionSummary, preparedRevision: expectedRevision })
    tx.update(booksRef, { books, revision, pendingCount, updatedAt: now })
    const newEntries = books.entries.slice((current.books as Books).entries.length).map(entry => entry.id)
    audit(tx, c.companyRef, actor, `accounting.${status === 'pending' ? 'prepare' : command.type}`, actionSummary, { revision, status, entryIds: newEntries, ...(pendingId ? { pendingId } : {}), ...(preparedBy ? { preparedBy } : {}), ...(command.type === 'attachSettlementDocuments' ? { settlementId: command.input.settlementId, documentPaths: (command.input.supportingDocuments as SettlementSupportingDocument[]).map(file => file.path) } : {}) })
    return { revision, status, ...(pendingId ? { pendingId } : {}) }
  })
})
