import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions'
import { birDatasetHtml, birDatasetTemplates, birYearListings, parseBirIssuances, parseSecCircular, secCircularLinks, stableRegulatoryId, regulatoryContentHash, type DiscoveredIssuance } from './regulatory-parser.js'

const birIndex = 'https://www.bir.gov.ph/revenue-issuances-details'
const sources = [
  { id: 'bir-rr', agency: 'BIR', name: 'BIR Revenue Regulations', url: birIndex, kind: 'RR' },
  { id: 'bir-rmc', agency: 'BIR', name: 'BIR Revenue Memorandum Circulars', url: birIndex, kind: 'RMC' },
  { id: 'bir-rmo', agency: 'BIR', name: 'BIR Revenue Memorandum Orders', url: birIndex, kind: 'RMO' },
  { id: 'sec-mc', agency: 'SEC', name: 'SEC recent Memorandum Circulars', url: 'https://www.sec.gov.ph/', kind: 'SEC_MC' },
] as const

/** Fetch only configured agency websites and their verified public BIR listing dataset API. */
async function officialFetch(url: string): Promise<string> {
  const parsed = new URL(url)
  const publicApi = parsed.hostname === 'bir-cms-ws.bir.gov.ph' && /^\/api\/pub\/templates\/\d{1,8}\/datasets$/.test(parsed.pathname)
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || (!publicApi && !['www.bir.gov.ph', 'www.sec.gov.ph', 'sec.gov.ph'].includes(parsed.hostname))) throw Error('A source returned an unsupported listing URL.')
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(25000), headers: { Accept: publicApi ? 'application/json' : 'text/html', 'User-Agent': 'UBB-Regulatory-Library/1.0 (official issuance link checks)', ...(publicApi ? { 'client-website-id': '2', Origin: 'https://www.bir.gov.ph' } : {}) } })
  if (!response.ok) throw Error(`The official source returned HTTP ${response.status}. Manual source review is required.`)
  const type = response.headers.get('content-type') || ''
  if (!/text\/html|application\/json/i.test(type)) throw Error('The official source returned an unsupported content type.')
  const reader = response.body?.getReader()
  if (!reader) throw Error('The official source returned no listing.')
  const chunks: Uint8Array[] = []; let bytes = 0
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break
      bytes += value.byteLength
      if (bytes > 4_000_000) { await reader.cancel(); throw Error('The official listing exceeds the supported size; manual source review is required.') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const text = Buffer.concat(chunks).toString('utf8')
  if (/<title>\s*just a moment|cf-chl-|verify you are human/i.test(text)) throw Error('The official source blocks automated checks. Review the agency website directly.')
  return text
}

export async function runRegulatorySync(): Promise<void> {
  const db = getFirestore(), checkedAt = new Date().toISOString()
  const year = Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date()))
  const cache = new Map<string, Promise<string>>()
  const read = (url: string) => { if (!cache.has(url)) cache.set(url, officialFetch(url)); return cache.get(url)! }
  async function birListing(url: string) {
    const html = await read(url), templates = birDatasetTemplates(html)
    return (await Promise.all(templates.map(async template => birDatasetHtml(JSON.parse(await read(`https://bir-cms-ws.bir.gov.ph/api/pub/templates/${template}/datasets?per_page=3000`)))))).join('\n')
  }
  async function discover(source: typeof sources[number]): Promise<DiscoveredIssuance[]> {
    if (source.kind === 'SEC_MC') {
      const links = secCircularLinks(await read(source.url), source.url)
      if (!links.length) throw Error('No supported SEC circular links were found. The listing may have changed.')
      const records = await Promise.all(links.map(async link => parseSecCircular(link, /\.pdf$/i.test(new URL(link.url).pathname) ? '' : await read(link.url), source.url)))
      return records.filter((record): record is DiscoveredIssuance => Boolean(record))
    }
    const pages = birYearListings(await birListing(birIndex), source.kind, year)
    if (!pages.length) throw Error('No current or previous-year BIR listing was found for this issuance type.')
    const groups = await Promise.all(pages.map(async url => {
      const html = await birListing(url), parsed = parseBirIssuances(html, url, source.kind)
      if (!parsed.length) throw Error('A BIR yearly listing contains no supported full-text issuance links. Review the source layout.')
      return parsed
    }))
    return groups.flat()
  }
  const outcomes = await Promise.allSettled(sources.map(async source => {
    const state = db.collection('regulatorySync').doc(source.id)
    await state.set({ sourceId: source.id, agency: source.agency, name: source.name, sourceUrl: source.url, lastAttemptAt: checkedAt, status: 'checking', schedule: 'Daily at 08:00 Asia/Manila' }, { merge: true })
    try {
      const records = [...new Map((await discover(source)).map(record => [record.url, record])).values()]
      if (!records.length || records.length > 1000) throw Error('The discovered listing count is outside the supported bounds; manual source review is required.')
      const counts = { newCount: 0, changedCount: 0 }
      for (let offset = 0; offset < records.length; offset += 150) {
        const group = records.slice(offset, offset + 150)
        const result = await db.runTransaction(async tx => {
          const refs = group.map(record => db.collection('regulatoryUpdates').doc(stableRegulatoryId(source.id, record.url)))
          const old = await tx.getAll(...refs)
          let added = 0, changed = 0
          group.forEach((record, i) => {
            const contentHash = regulatoryContentHash(record), previous = old[i]
            const changedContent = previous.exists && previous.get('contentHash') !== contentHash
            if (!previous.exists) added++; else if (changedContent) changed++
            tx.set(refs[i], { ...record, sourceId: source.id, sourceName: source.name, contentHash, status: 'needs_review', firstSeenAt: previous.get('firstSeenAt') || checkedAt, lastSeenAt: checkedAt, lastChangedAt: !previous.exists || changedContent ? checkedAt : previous.get('lastChangedAt') || checkedAt }, { merge: true })
          })
          return { added, changed }
        })
        counts.newCount += result.added; counts.changedCount += result.changed
      }
      await state.set({ status: 'success', lastSuccessAt: checkedAt, lastError: '', foundCount: records.length, ...counts, coverage: source.kind === 'SEC_MC' ? 'Recent Memorandum Circular announcements on the SEC homepage' : `Published ${year} and ${year - 1} yearly listings; existing documents are retained` }, { merge: true })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.slice(0, 500) : 'The official source could not be checked.'
      await state.set({ status: 'failed', lastFailureAt: checkedAt, lastError: message }, { merge: true })
      logger.error('Regulatory source check failed', { sourceId: source.id, error: message })
      throw Error(`${source.name}: ${message}`)
    }
  }))
  if (outcomes.some(outcome => outcome.status === 'rejected')) throw Error('One or more official regulatory sources could not be refreshed. See regulatorySync source states.')
}

export const dailyRegulatorySync = onSchedule({ schedule: '0 8 * * *', timeZone: 'Asia/Manila', region: 'asia-southeast1', timeoutSeconds: 300, memory: '512MiB', maxInstances: 1, retryCount: 1 }, async () => { await runRegulatorySync() })
