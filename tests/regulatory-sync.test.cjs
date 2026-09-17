const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const ts = require('typescript')
function load(name, mockedRequire) {
  const source = readFileSync(new URL(`../functions/src/${name}.ts`, `file://${__filename}`), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }; new Function('require', 'module', 'exports', code)(mockedRequire, module, module.exports); return module.exports
}
const parser = load('regulatory-parser', require)

test('source failures preserve last success while other sources save deduplicated review records', async () => {
  const documents = new Map([['regulatorySync/sec-mc', { status: 'success', lastSuccessAt: '2020-01-01T00:00:00.000Z' }]])
  const reference = path => ({ path, set: async (value, options) => { documents.set(path, options?.merge ? { ...documents.get(path), ...value } : value) } })
  const snapshot = ref => ({ exists: documents.has(ref.path), get: key => documents.get(ref.path)?.[key] })
  const database = { collection: name => ({ doc: id => reference(`${name}/${id}`) }), runTransaction: fn => fn({ getAll: async (...refs) => refs.map(snapshot), set: (ref, value, options) => { void ref.set(value, options) } }) }
  let scheduleOptions
  const sync = load('regulatory-sync', name => {
    if (name === 'firebase-admin/firestore') return { getFirestore: () => database }
    if (name === 'firebase-functions/v2/scheduler') return { onSchedule: (options, fn) => { scheduleOptions = options; return fn } }
    if (name === 'firebase-functions') return { logger: { error: () => {} } }
    if (name === './regulatory-parser.js') return parser
    return require(name)
  })
  const year = new Date().getFullYear()
  const names = ['Revenue-Regulations', 'Revenue-Memorandum-Circulars', 'Revenue-Memorandum-Orders']
  const kinds = ['RR', 'RMC', 'RMO']
  const nextPayload = template => `<script>self.__next_f.push([1,${JSON.stringify(`4:{"source":"dataset","code":"${template}"}`)}])</script>`
  let empty = false, fetched = []
  const originalFetch = global.fetch
  global.fetch = async (rawUrl, options) => {
    const url = new URL(rawUrl); fetched.push(url.href)
    assert.equal(url.protocol, 'https:'); assert.equal(options.redirect, 'error')
    if (url.hostname === 'www.sec.gov.ph') return new Response('Denied', { status: 403, headers: { 'content-type': 'text/html' } })
    let body, type = 'text/html'
    if (url.pathname === '/revenue-issuances-details') body = nextPayload(1)
    else if (url.hostname === 'www.bir.gov.ph') { const index = names.indexOf(url.pathname.slice(6)); assert.ok(index >= 0); body = nextPayload(index + 2) }
    else {
      assert.equal(url.hostname, 'bir-cms-ws.bir.gov.ph'); assert.equal(options.headers['client-website-id'], '2')
      const template = Number(url.pathname.split('/')[4]); type = 'application/json'
      const kind = kinds[template - 2]
      const html = template === 1 ? names.map(name => `<a href="${year}-${name}">${year}</a>`).join('') : empty ? '<p>The listing layout has changed</p>' : `<table><tr><td>${kind} No. 1-${year}</td><td>Sample regulation <a href="https://bir-cdn.bir.gov.ph/BIR/pdf/${kind}1-${year}.pdf">Full Text</a></td><td>January 1, ${year}</td></tr></table>`
      body = JSON.stringify({ data: [{ is_active: 1, content: { Content: html } }], meta: { last_page: 1 }, links: { next: null } })
    }
    return new Response(body, { headers: { 'content-type': type } })
  }
  try {
    await assert.rejects(sync.runRegulatorySync(), /could not be refreshed/)
    assert.equal(scheduleOptions.schedule, '0 8 * * *'); assert.equal(scheduleOptions.timeZone, 'Asia/Manila')
    assert.equal(documents.get('regulatorySync/sec-mc').lastSuccessAt, '2020-01-01T00:00:00.000Z')
    assert.equal(documents.get('regulatorySync/sec-mc').status, 'failed')
    assert.match(documents.get('regulatorySync/sec-mc').lastError, /403/)
    for (const id of ['bir-rr', 'bir-rmc', 'bir-rmo']) assert.equal(documents.get(`regulatorySync/${id}`).status, 'success')
    const discovered = [...documents].filter(([key]) => key.startsWith('regulatoryUpdates/'))
    assert.equal(discovered.length, 3); assert.ok(discovered.every(([, value]) => value.status === 'needs_review'))
    const [recordId] = discovered[0]; documents.set(recordId, { ...documents.get(recordId), firstSeenAt: '2020-02-01T00:00:00.000Z' })
    await assert.rejects(sync.runRegulatorySync())
    assert.equal([...documents.keys()].filter(key => key.startsWith('regulatoryUpdates/')).length, 3)
    assert.equal(documents.get(recordId).firstSeenAt, '2020-02-01T00:00:00.000Z')
    assert.equal(documents.get('regulatorySync/bir-rr').newCount, 0)
    const lastSuccess = documents.get('regulatorySync/bir-rr').lastSuccessAt
    empty = true; fetched = []
    await assert.rejects(sync.runRegulatorySync())
    assert.equal(documents.get('regulatorySync/bir-rr').status, 'failed')
    assert.equal(documents.get('regulatorySync/bir-rr').lastSuccessAt, lastSuccess)
    assert.match(documents.get('regulatorySync/bir-rr').lastError, /no supported/)
    assert.equal([...documents.keys()].filter(key => key.startsWith('regulatoryUpdates/')).length, 3)
  } finally { global.fetch = originalFetch }
})
