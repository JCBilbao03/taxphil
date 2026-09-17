import { createHash } from 'node:crypto'

export type RegulatoryAgency = 'BIR' | 'SEC'
export type DiscoveredIssuance = { agency: RegulatoryAgency; code: string; title: string; url: string; sourceUrl: string; issuedOn: string; kind: string }
export type ListingLink = { url: string; text: string }
const officialHosts = { BIR: ['www.bir.gov.ph', 'bir.gov.ph', 'bir-cdn.bir.gov.ph'], SEC: ['www.sec.gov.ph', 'sec.gov.ph'] }
export function decodeHtml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity: string) => {
    const names: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }
    if (entity[0] !== '#') return names[entity.toLowerCase()] || ''
    const point = Number.parseInt(entity.slice(entity[1].toLowerCase() === 'x' ? 2 : 1), entity[1].toLowerCase() === 'x' ? 16 : 10)
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ''
  })
}
export function plainText(html: string): string {
  return decodeHtml(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}
export function officialUrl(value: string, base: string, agency: RegulatoryAgency): string | null {
  try {
    const url = new URL(decodeHtml(value.trim()), base)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !officialHosts[agency].includes(url.hostname) || url.href.length > 2000) return null
    url.hash = ''
    if (/\.pdf$/i.test(url.pathname)) url.search = ''
    return url.href
  } catch { return null }
}
export function listingLinks(html: string, base: string, agency: RegulatoryAgency): ListingLink[] {
  const result: ListingLink[] = []
  // Parse attributes as text. Agency page contents are never executed or used as instructions.
  const clean = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  for (const match of clean.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(match[1])
    if (!href) continue
    const url = officialUrl(href[1] ?? href[2] ?? href[3], base, agency)
    if (url) result.push({ url, text: plainText(match[2]).slice(0, 1000) })
  }
  return result
}
/** BIR's public Next.js payload supplies the numeric dataset template used by that listing. */
export function birDatasetTemplates(html: string): string[] {
  const payloads: string[] = []
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g)) {
    try { const parsed: unknown = JSON.parse(match[1]); if (typeof parsed === 'string') payloads.push(parsed) } catch { /* An incomplete payload cannot supply a dataset. */ }
  }
  const templates = [...new Set(payloads.flatMap(payload => [...payload.matchAll(/"code"\s*:\s*"(\d{1,8})"/g)].map(match => match[1])))]
  if (!templates.length || templates.length > 8) throw Error('The official BIR listing layout changed; manual source review is required.')
  return templates
}
/** Only active public dataset content is used; pagination must be complete. */
export function birDatasetHtml(value: unknown): string {
  if (!value || typeof value !== 'object') throw Error('The official BIR listing returned an unexpected response.')
  const payload = value as { data?: unknown; meta?: { last_page?: number }; links?: { next?: unknown } }
  if (!Array.isArray(payload.data) || payload.data.length > 3000 || (payload.meta?.last_page || 1) > 1 || payload.links?.next) throw Error('The official BIR listing is incomplete; manual source review is required.')
  const html = payload.data.flatMap(row => {
    if (!row || typeof row !== 'object' || row.is_active !== 1 || !row.content || typeof row.content !== 'object') return []
    return Object.values(row.content).filter((text): text is string => typeof text === 'string')
  }).join('\n')
  if (!html || html.length > 4_000_000) throw Error('No supported issuance listing was returned by BIR.')
  return html
}
export function birYearListings(html: string, kind: 'RR' | 'RMC' | 'RMO', year: number): string[] {
  const suffix = { RR: 'Revenue-Regulations', RMC: 'Revenue-Memorandum-Circulars', RMO: 'Revenue-Memorandum-Orders?' }[kind]
  const path = new RegExp(`^/(${year}|${year - 1})-${suffix}$`, 'i')
  return [...new Set(listingLinks(html, 'https://www.bir.gov.ph/', 'BIR').flatMap(link => {
    const url = new URL(link.url)
    if (url.hostname !== 'www.bir.gov.ph' || !path.test(url.pathname)) return []
    url.search = ''; return [url.href]
  }))]
}
function issuanceDate(value: string): string {
  const text = plainText(value)
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december']
  const match = /^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i.exec(text)
  if (!match) return ''
  const month = months.indexOf(match[1].toLowerCase()) + 1
  if (!month) return ''
  const date = `${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`
  const parsed = new Date(date + 'T00:00:00Z')
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : ''
}
export function parseBirIssuances(html: string, sourceUrl: string, expectedKind: 'RR' | 'RMC' | 'RMO'): DiscoveredIssuance[] {
  const records = new Map<string, DiscoveredIssuance>()
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(item => item[1])
    if (cells.length < 2) continue
    const codeMatch = new RegExp(`^${expectedKind}\\s*(?:No\\.?\\s*)?(\\d{1,4})\\s*[-–]\\s*(\\d{4})$`, 'i').exec(plainText(cells[0]))
    if (!codeMatch) continue
    const code = `${expectedKind} ${Number(codeMatch[1])}-${codeMatch[2]}`
    const links = listingLinks(cells[1], sourceUrl, 'BIR')
    const fullText = links.find(link => /^full\s*text$/i.test(link.text) && /\.pdf$/i.test(new URL(link.url).pathname))
    if (!fullText) continue
    const title = plainText(cells[1].replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, '')).replace(/[|\s]+$/g, '').slice(0, 1000)
    records.set(fullText.url, { agency: 'BIR', code, title: title || code, url: fullText.url, sourceUrl, issuedOn: issuanceDate(cells[2] || ''), kind: { RR: 'Revenue Regulations', RMC: 'Revenue Memorandum Circular', RMO: 'Revenue Memorandum Order' }[expectedKind] })
  }
  return [...records.values()]
}
export function secCircularLinks(html: string, sourceUrl: string): ListingLink[] {
  return [...new Map(listingLinks(html, sourceUrl, 'SEC').filter(link => /^(?:SEC\s+)?MC\s*(?:No\.?\s*)?\d{1,3}\b/i.test(link.text) && !/request for comments|draft/i.test(link.text)).map(link => [link.url, link])).values()].slice(0, 40)
}
export function parseSecCircular(link: ListingLink, html: string, sourceUrl: string): DiscoveredIssuance | null {
  const match = /(?:SEC\s+)?MC\s*(?:No\.?\s*)?(\d{1,3})\s*[,–-]?\s*(?:series\s+of|s\.?)\s*(\d{4})/i.exec(link.text)
  if (!match) return null
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)
  const title = (h1 ? plainText(h1[1]) : link.text).slice(0, 1000)
  // SEC circular detail pages commonly embed their PDF in an iframe.
  const candidates = [...listingLinks(html, link.url, 'SEC').map(item => item.url)]
  for (const embed of html.matchAll(/<(?:iframe|embed|object)\b[^>]*\b(?:src|data)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const url = officialUrl(embed[1], link.url, 'SEC'); if (url) candidates.push(url)
  }
  const code = `SEC MC ${Number(match[1])}-${match[2]}`
  const pdfs = [...new Set(candidates.filter(url => /\.pdf$/i.test(new URL(url).pathname)))]
  // Multiple unrelated PDFs are ambiguous, so retain the official article rather than guessing.
  const url = pdfs.length === 1 ? pdfs[0] : link.url
  return { agency: 'SEC', code, title: title || link.text, url, sourceUrl, issuedOn: '', kind: 'Memorandum Circular' }
}
export const stableRegulatoryId = (sourceId: string, url: string) => createHash('sha256').update(sourceId + '\n' + url).digest('hex')
export const regulatoryContentHash = (record: DiscoveredIssuance) => createHash('sha256').update(JSON.stringify(record)).digest('hex')
