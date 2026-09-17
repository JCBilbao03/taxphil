const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const ts = require('typescript')
const source = readFileSync(new URL('../functions/src/regulatory-parser.ts', `file://${__filename}`), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const moduleObject = { exports: {} }
new Function('require', 'module', 'exports', compiled)(require, moduleObject, moduleObject.exports)
const { birDatasetTemplates, birDatasetHtml, birYearListings, parseBirIssuances, parseSecCircular, secCircularLinks, stableRegulatoryId, regulatoryContentHash, listingLinks } = moduleObject.exports

// Minimal synthetic fixtures follow the published BIR listing shape verified on 2026-09-17.
const rrListing = `<table><tbody><tr><td>RR No. 4-2026</td><td>Sample regulation &amp; amendment<br><a href="https://bir-cdn.bir.gov.ph/BIR/pdf/RR No. 4-2026 Digest.pdf">Digest</a> | <a href="https://bir-cdn.bir.gov.ph/BIR/pdf/RR No. 4-2026.pdf">Full Text</a> | <a href="https://bir-cdn.bir.gov.ph/BIR/pdf/Form.pdf">Application Form</a></td><td>June 22, 2026</td></tr></tbody></table>`
test('BIR parser selects full text, preserves code/subject, and parses an actual issue date', () => {
  const records = parseBirIssuances(rrListing, 'https://www.bir.gov.ph/2026-Revenue-Regulations', 'RR')
  assert.equal(records.length, 1)
  assert.equal(records[0].code, 'RR 4-2026')
  assert.equal(records[0].title, 'Sample regulation & amendment')
  assert.equal(records[0].issuedOn, '2026-06-22')
  assert.equal(records[0].url, 'https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%204-2026.pdf')
  assert.equal(parseBirIssuances(rrListing, 'https://www.bir.gov.ph/', 'RMC').length, 0)
})
test('BIR dataset parser reads escaped public metadata without executing page scripts', () => {
  const payload = '4:["$",null,{"sections":[{"source":"dataset","code":"3754"}]}]'
  const html = `<script>self.__next_f.push([1,${JSON.stringify(payload)}])</script><script>throw Error('must never execute')</script>`
  assert.deepEqual(birDatasetTemplates(html), ['3754'])
  assert.throws(() => birDatasetTemplates('<html>New layout</html>'), /layout changed/)
  assert.equal(birDatasetHtml({ data: [{ is_active: 1, content: { Content: rrListing } }, { is_active: 0, content: { Content: 'ignore' } }], meta: { last_page: 1 }, links: { next: null } }), rrListing)
  assert.throws(() => birDatasetHtml({ data: [], meta: { last_page: 2 } }), /incomplete/)
})
test('BIR index discovery follows only current and previous year paths from the official listing', () => {
  const html = '<a href="2026-Revenue-Regulations?type=PAGE&amp;to=x">2026</a><a href="2025-Revenue-Regulations">2025</a><a href="2024-Revenue-Regulations">2024</a><a href="2026-Revenue-Memorandum-Circulars">2026 RMC</a><a href="https://evil.example/2026-Revenue-Regulations">Bad</a>'
  assert.deepEqual(birYearListings(html, 'RR', 2026), ['https://www.bir.gov.ph/2026-Revenue-Regulations', 'https://www.bir.gov.ph/2025-Revenue-Regulations'])
})
test('external, credentialed, deceptive and active-protocol document links are rejected', () => {
  const base = 'https://www.bir.gov.ph/'
  const links = listingLinks('<a href="javascript:alert(1)">bad</a><a href="https://www.bir.gov.ph.evil.example/a.pdf">bad</a><a href="https://user:pass@www.bir.gov.ph/a.pdf">bad</a><a href="http://www.bir.gov.ph/a.pdf">bad</a><script><a href="https://www.bir.gov.ph/not-real.pdf">bad</a></script><a href="/ok.pdf">Good</a>', base, 'BIR')
  assert.deepEqual(links, [{ url: 'https://www.bir.gov.ph/ok.pdf', text: 'Good' }])
})
test('unrecognized dates are left unfilled and missing full-text links do not become regulations', () => {
  const malformed = rrListing.replace('June 22, 2026', 'February 31, 2026')
  assert.equal(parseBirIssuances(malformed, 'https://www.bir.gov.ph/', 'RR')[0].issuedOn, '')
  assert.equal(parseBirIssuances(rrListing.replace('>Full Text<', '>Annex<'), 'https://www.bir.gov.ph/', 'RR').length, 0)
})
test('SEC filters draft consultations and retains the official article when PDFs are ambiguous', () => {
  const html = '<a href="/mc-2026/example/">SEC MC No. 25, series of 2026 Sample circular</a><a href="/consultation/">REQUEST FOR COMMENTS SEC MC No. 26, series of 2026</a><a href="/draft/">SEC MC No. 27, series of 2026 draft</a>'
  const links = secCircularLinks(html, 'https://www.sec.gov.ph/')
  assert.equal(links.length, 1)
  const record = parseSecCircular(links[0], '<h1>Sample circular</h1><iframe src="/wp-content/uploads/2026/09/MC25.pdf"></iframe>', 'https://www.sec.gov.ph/')
  assert.equal(record.code, 'SEC MC 25-2026')
  assert.equal(record.url, 'https://www.sec.gov.ph/wp-content/uploads/2026/09/MC25.pdf')
  const ambiguous = parseSecCircular(links[0], '<a href="/a.pdf">A</a><a href="/b.pdf">B</a>', 'https://www.sec.gov.ph/')
  assert.equal(ambiguous.url, links[0].url)
  assert.equal(record.issuedOn, '')
})
test('stable identifiers deduplicate repeated checks, while content hashes detect revisions', () => {
  const record = parseBirIssuances(rrListing, 'https://www.bir.gov.ph/2026-Revenue-Regulations', 'RR')[0]
  assert.equal(stableRegulatoryId('bir-rr', record.url), stableRegulatoryId('bir-rr', record.url))
  assert.notEqual(stableRegulatoryId('bir-rmc', record.url), stableRegulatoryId('bir-rr', record.url))
  assert.notEqual(regulatoryContentHash(record), regulatoryContentHash({ ...record, title: 'Updated subject' }))
})
