import { createHash, randomUUID } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { companyIdentity, companyContext, companyRequireRole, companyAudit } from './company-accounting.js'
import { post, reverse, type Books } from './accounting-engine.js'
import { assertBankLedgerChangeAllowed } from './bank-locks.js'
import { assetAllocations, assetBalances, effectiveAssetEvents, emptyAssetControl, previewAssetCommand, validateAssetAllocation, validateAssetCommand, type AssetCommand, type AssetControl, type AssetEvent, type AssetPreview, type AssetRecord, type AssetRun } from './assets.js'

const now = () => new Date().toISOString()
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpsError('invalid-argument', 'Provide asset workflow details.'); return value as Record<string, unknown> }
const id = (value: unknown) => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError('invalid-argument', 'Provide a valid asset action reference.'); return value }
const revision = (value: unknown) => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new HttpsError('invalid-argument', 'Provide the current asset register revision.'); return value }
function valid<T>(fn: () => T): T { try { return fn() } catch (error) { if (error instanceof HttpsError) throw error; throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'Review the asset action.') } }
function capacity(value: unknown, bytes: number, label: string) { if (Buffer.byteLength(JSON.stringify(value), 'utf8') > bytes) throw new HttpsError('resource-exhausted', `${label} reached the supported capacity. Export and arrange a capacity upgrade before continuing.`) }
const fingerprint = (command: AssetCommand) => createHash('sha256').update(JSON.stringify(command)).digest('hex')
function affected(assets: AssetRecord[], command: AssetCommand, original?: AssetRun): AssetRecord[] {
  const ids = command.kind === 'register' ? [] : command.kind === 'reverse' ? original?.resultAssetIds || [] : command.kind === 'depreciation' ? command.assetIds : [command.assetId]
  return ids.map(key => { const asset = assets.find(row => row.id === key); if (!asset) throw new HttpsError('not-found', 'An affected asset no longer exists.'); return asset })
}
function reversalPreview(assets: AssetRecord[], books: Books, command: Extract<AssetCommand, { kind: 'reverse' }>, original: AssetRun | undefined): AssetPreview {
  if (!original || original.status !== 'posted' || original.command.kind === 'reverse') throw Error('Choose a posted asset action that has not been reversed. Reversal actions cannot be reversed again.')
  const rows = affected(assets, command, original)
  if (!rows.length || rows.some(asset => effectiveAssetEvents(asset).at(-1)?.runId !== original.id)) throw Error('Only the latest action for every affected asset can be reversed. Reverse later actions first.')
  if (command.date < original.command.date || rows.some(asset => asset.events.some(event => event.date > command.date))) throw Error('A reversal cannot precede the original action or later asset activity.')
  const entry = original.entryId ? books.entries.find(row => row.id === original.entryId) : undefined
  if (original.entryId && (!entry || books.entries.some(row => row.reversalOf === original.entryId))) throw Error('The original asset journal is missing or has already been reversed.')
  return { rows: rows.map(asset => ({ assetId: asset.id, code: asset.code, name: asset.name, ...assetBalances(asset), change: -asset.events.find(event => event.runId === original.id)!.depreciationExpense })), lines: entry ? entry.lines.map(line => ({ account: line.account, debit: line.credit, credit: line.debit })) : [], total: -(original.preview.total || 0), description: `Reverse asset action ${original.command.reference} · ${command.reference}` }
}
function preview(assets: AssetRecord[], books: Books, control: AssetControl, command: AssetCommand, original?: AssetRun) {
  if (command.kind === 'register') {
    if (assets.length >= 100) throw Error('This release supports 100 retained asset records per company.')
    if (command.input.sourceEntryId && command.date < (control.sourceAvailableFrom?.[command.input.sourceEntryId] || '')) throw Error('Register this reallocated source on or after its previous asset registration reversal date to preserve historical balances.')
    if (command.input.sourceEntryId && assets.some(asset => asset.events.some(event => event.entryId === command.input.sourceEntryId))) throw Error('This journal already belongs to an asset action. Select the original external acquisition source or record a reviewed opening balance.')
    validateAssetAllocation(command.input, books, control.allocations)
  }
  if (books.closedThrough && command.date <= books.closedThrough && !(command.kind === 'register' && command.input.sourceMode === 'existing_entry')) throw Error(`The books are closed through ${books.closedThrough}. Use a later action date.`)
  // Registering historical balances without a new journal is allowed across a closed period.
  return command.kind === 'reverse' ? reversalPreview(assets, books, command, original) : previewAssetCommand(assets, books, command)
}
function eventFor(asset: AssetRecord, command: AssetCommand, runId: string, entryId: string, result: AssetPreview): AssetEvent {
  const event: AssetEvent = { id: randomUUID(), runId, kind: command.kind, date: command.date, reference: command.reference, note: command.kind === 'register' ? command.input.notes : command.note, entryId, costDelta: 0, depreciationDelta: 0, impairmentDelta: 0, depreciationExpense: 0, proceeds: 0 }
  const b = assetBalances(asset)
  if (command.kind === 'register') Object.assign(event, { costDelta: asset.cost, depreciationDelta: asset.openingDepreciation, impairmentDelta: asset.openingImpairment, location: asset.location, custodian: asset.custodian })
  if (command.kind === 'depreciation') { const amount = result.rows.find(row => row.assetId === asset.id)!.change; Object.assign(event, { depreciationDelta: amount, depreciationExpense: amount, throughMonth: command.throughMonth }) }
  if (command.kind === 'transfer') Object.assign(event, { location: command.location, custodian: command.custodian })
  if (command.kind === 'impairment') event.impairmentDelta = command.amount
  if (command.kind === 'disposal') Object.assign(event, { costDelta: -b.cost, depreciationDelta: -b.depreciation, impairmentDelta: -b.impairment, depreciationExpense: command.finalDepreciation, proceeds: command.proceeds })
  if (command.kind === 'reverse') { const old = asset.events.find(item => item.runId === command.runId)!; Object.assign(event, { costDelta: -old.costDelta, depreciationDelta: -old.depreciationDelta, impairmentDelta: -old.impairmentDelta, depreciationExpense: -old.depreciationExpense, proceeds: -old.proceeds, reversesEventId: old.id }) }
  return event
}

/** Client calls reach this handler publicly; verified identity and current tenant/role authorize every action. */
export const companyAssets = onCall({ region: 'asia-southeast1', timeoutSeconds: 60, maxInstances: 20 }, async request => {
  const actor = await companyIdentity(request), data = object(request.data), expected = revision(data.expectedRevision)
  if (!['prepare', 'approve', 'reject'].includes(String(data.action))) throw new HttpsError('invalid-argument', 'Choose prepare, approve or reject.')
  const action = String(data.action), runId = id(action === 'prepare' ? data.requestId : data.id)
  return getFirestore().runTransaction(async tx => {
    const { companyRef, member } = await companyContext(tx, actor)
    companyRequireRole(member, action === 'prepare' ? ['admin', 'manager', 'accountant'] : ['admin', 'manager'])
    const controlRef = companyRef.collection('assetControl').doc('default'), booksRef = companyRef.collection('accounting').doc('books'), runRef = companyRef.collection('assetRuns').doc(runId)
    const [controlDoc, booksDoc, runDoc, records, draftRecords] = await Promise.all([tx.get(controlRef), tx.get(booksRef), tx.get(runRef), tx.get(companyRef.collection('assets')), tx.get(companyRef.collection('assetRuns').where('status', '==', 'draft'))])
    if (!booksDoc.exists) throw new HttpsError('failed-precondition', 'Company books are unavailable.')
    const control: AssetControl = controlDoc.exists ? controlDoc.data() as AssetControl : emptyAssetControl(), books = booksDoc.get('books') as Books, assets = records.docs.map(doc => ({ ...doc.data(), id: doc.id } as AssetRecord)), saved = runDoc.exists ? { ...runDoc.data(), id: runId } as AssetRun : undefined
    if (action === 'prepare' && saved) {
      const command = valid(() => validateAssetCommand(data.command, books))
      if (saved.preparedBy !== actor.uid || fingerprint(command) !== fingerprint(saved.command)) throw new HttpsError('already-exists', 'This action reference was used for different details. Start a new request.')
      return { id: runId, status: saved.status, revision: control.revision }
    }
    if (action === 'approve' && saved?.status === 'posted') return { id: runId, status: saved.status, revision: control.revision, entryId: saved.entryId || '', alreadyPosted: true }
    if (action === 'reject' && saved?.status === 'rejected') return { id: runId, status: saved.status, revision: control.revision, alreadyRejected: true }
    if (control.revision !== expected) throw new HttpsError('aborted', 'The asset register changed. Refresh and review before retrying.')
    if (action !== 'prepare' && (!saved || saved.status !== 'draft')) throw new HttpsError('failed-precondition', 'This asset action is no longer awaiting review.')
    const command = valid(() => validateAssetCommand(action === 'prepare' ? data.command : saved!.command, books))
    const originalDoc = command.kind === 'reverse' ? await tx.get(companyRef.collection('assetRuns').doc(command.runId)) : undefined
    const original = originalDoc?.exists ? { ...originalDoc.data(), id: originalDoc.id } as AssetRun : undefined
    const selected = affected(assets, command, original)
    const timestamp = now(), nextControl = structuredClone(control); nextControl.revision++
    if (action === 'reject') {
      const reviewNote = typeof data.reviewNote === 'string' ? data.reviewNote.trim() : ''
      if (reviewNote.length < 10 || reviewNote.length > 2000) throw new HttpsError('invalid-argument', 'Explain the rejection using 10–2,000 characters.')
      tx.update(runRef, { status: 'rejected', version: saved!.version + 1, approvedBy: actor.uid, approvedAt: timestamp, reviewNote })
      tx.set(controlRef, nextControl); companyAudit(tx, companyRef, actor, 'asset.reject', `Rejected asset action ${command.reference}`, { runId })
      return { id: runId, status: 'rejected', revision: nextControl.revision }
    }
    const result = valid(() => preview(assets, books, control, command, original))
    if (action === 'prepare') {
      if (draftRecords.docs.length >= 100) throw new HttpsError('resource-exhausted', 'Review pending asset actions before preparing more.')
      if (draftRecords.docs.some(doc => (doc.data().command as AssetCommand).reference.toLowerCase() === command.reference.toLowerCase()) || assets.some(asset => asset.events.some(event => event.reference.toLowerCase() === command.reference.toLowerCase()))) throw new HttpsError('already-exists', 'This asset action reference is already used.')
      const run: AssetRun = { id: runId, version: 1, command, status: 'draft', preparedBy: actor.uid, preparedAt: timestamp, preparedBooksRevision: booksDoc.get('revision'), assetVersions: Object.fromEntries(selected.map(asset => [asset.id, asset.version])), preview: result }
      capacity(run, 600000, 'Asset action'); tx.create(runRef, run); tx.set(controlRef, nextControl)
      companyAudit(tx, companyRef, actor, 'asset.prepare', result.description, { runId })
      return { id: runId, status: 'draft', revision: nextControl.revision }
    }
    if (saved!.preparedBy === actor.uid) throw new HttpsError('permission-denied', 'Another Admin or Manager must review the asset action you prepared.')
    if (saved!.preparedBooksRevision !== booksDoc.get('revision') || selected.some(asset => saved!.assetVersions[asset.id] !== asset.version)) throw new HttpsError('aborted', 'The books or affected assets changed after preparation. Reject this draft and prepare it again.')
    const reviewNote = typeof data.reviewNote === 'string' ? data.reviewNote.trim() : ''
    if (reviewNote.length < 10 || reviewNote.length > 2000) throw new HttpsError('invalid-argument', 'Record the independent review using 10–2,000 characters.')
    let nextBooks = books, entryId = ''
    if (result.lines.length) {
      nextBooks = valid(() => command.kind === 'reverse' && original?.entryId ? reverse(books, original.entryId, command.date) : post(books, { date: command.date, reference: command.reference, description: result.description, source: 'journal', lines: result.lines }))
      entryId = nextBooks.entries.at(-1)!.id
      if (nextBooks.entries.length > 2000 || nextBooks.accounts.length > 500) throw new HttpsError('resource-exhausted', 'The company books reached their supported capacity.')
      capacity(nextBooks, 650000, 'Company books')
    }
    const changed = command.kind === 'register' ? [{ ...command.input, id: randomUUID(), version: 0, createdAt: timestamp, createdBy: saved!.preparedBy, events: [] } satisfies AssetRecord] : selected
    const nextAssets = changed.map(asset => { const value = { ...asset, version: asset.version + 1, events: [...asset.events, eventFor(asset, command, runId, entryId, result)] }; if (value.events.length > 1000) throw new HttpsError('resource-exhausted', 'This asset reached its supported event limit.'); capacity(value, 600000, 'Asset history'); return value })
    if (command.kind === 'register') {
      nextControl.assetCount = assets.length + 1
      for (const [key, amount] of Object.entries(assetAllocations(command.input))) nextControl.allocations[key] = (nextControl.allocations[key] || 0) + amount
      if (command.input.sourceEntryId) nextControl.protectedEntryIds.push(command.input.sourceEntryId)
    }
    if (command.kind === 'reverse' && original?.command.kind === 'register') {
      for (const [key, amount] of Object.entries(assetAllocations(original.command.input))) { nextControl.allocations[key] = Math.max(0, (nextControl.allocations[key] || 0) - amount); if (!nextControl.allocations[key]) delete nextControl.allocations[key] }
      const sourceId = original.command.input.sourceEntryId
      if (sourceId) nextControl.sourceAvailableFrom = { ...nextControl.sourceAvailableFrom, [sourceId]: command.date }
      if (sourceId && !Object.keys(nextControl.allocations).some(key => key.startsWith(`${sourceId}|`))) nextControl.protectedEntryIds = nextControl.protectedEntryIds.filter(key => key !== sourceId)
    }
    if (entryId) nextControl.protectedEntryIds.push(entryId)
    nextControl.protectedEntryIds = [...new Set(nextControl.protectedEntryIds)]
    if (nextControl.protectedEntryIds.length > 2200 || Object.keys(nextControl.allocations).length > 300) throw new HttpsError('resource-exhausted', 'Asset source controls reached their supported capacity.')
    capacity(nextControl, 500000, 'Asset source controls')
    await assertBankLedgerChangeAllowed(tx, companyRef, books, nextBooks)
    for (const asset of nextAssets) { const ref = companyRef.collection('assets').doc(asset.id); if (command.kind === 'register') tx.create(ref, asset); else tx.update(ref, asset) }
    if (entryId) tx.update(booksRef, { books: nextBooks, revision: booksDoc.get('revision') + 1, updatedAt: timestamp })
    tx.set(controlRef, nextControl)
    tx.update(runRef, { status: 'posted', version: saved!.version + 1, preview: result, approvedBy: actor.uid, approvedAt: timestamp, reviewNote, entryId, resultAssetIds: nextAssets.map(asset => asset.id) })
    if (command.kind === 'reverse' && originalDoc) tx.update(originalDoc.ref, { status: 'reversed', version: original!.version + 1, reversedByRunId: runId })
    companyAudit(tx, companyRef, actor, `asset.${command.kind}`, result.description, { runId, entryId, assetIds: nextAssets.map(asset => asset.id), revision: nextControl.revision })
    return { id: runId, status: 'posted', revision: nextControl.revision, entryId, assetIds: nextAssets.map(asset => asset.id) }
  })
})
