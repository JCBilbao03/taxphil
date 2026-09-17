import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import type { Plugin } from 'vite'

const require = createRequire(import.meta.url)
const OCR_VERSION = '7.0.0'
type LocalAsset = { name: string; filename: string }

/** Runtime engines and trained data are served from this application, never an OCR CDN. */
export function supplierOcrAssets(): LocalAsset[] {
  const pdfRoot = path.dirname(require.resolve('pdfjs-dist/package.json'))
  const ocrRoot = path.dirname(require.resolve('tesseract.js/package.json'))
  const coreRoot = path.dirname(require.resolve('tesseract.js-core/package.json'))
  const englishRoot = path.dirname(require.resolve('@tesseract.js-data/eng/package.json'))
  const pdfVersion = JSON.parse(fs.readFileSync(path.join(pdfRoot, 'package.json'), 'utf8')).version as string
  const ocrVersion = JSON.parse(fs.readFileSync(path.join(ocrRoot, 'package.json'), 'utf8')).version as string
  const coreVersion = JSON.parse(fs.readFileSync(path.join(coreRoot, 'package.json'), 'utf8')).version as string
  if (ocrVersion !== OCR_VERSION || coreVersion !== OCR_VERSION) throw Error(`Supplier OCR worker protocol is tested with Tesseract ${OCR_VERSION}; review the reader before upgrading it.`)
  const assets: LocalAsset[] = []
  const add = (filename: string, name: string) => { if (!fs.statSync(filename).isFile()) throw Error(`Missing supplier PDF asset: ${filename}`); assets.push({ name: `supplier-ocr/${name}`, filename }) }
  const directory = (folder: string, prefix: string) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.isDirectory()) directory(path.join(folder, entry.name), `${prefix}/${entry.name}`)
      else if (entry.isFile()) add(path.join(folder, entry.name), `${prefix}/${entry.name}`)
    }
  }
  add(path.join(pdfRoot, 'build/pdf.worker.min.mjs'), `pdfjs-${pdfVersion}/pdf.worker.min.mjs`)
  for (const folder of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) directory(path.join(pdfRoot, folder), `pdfjs-${pdfVersion}/${folder}`)
  add(path.join(pdfRoot, 'LICENSE'), `pdfjs-${pdfVersion}/LICENSE`)
  add(path.join(ocrRoot, 'dist/worker.min.js'), `tesseract-${OCR_VERSION}/worker.min.js`)
  add(path.join(ocrRoot, 'dist/worker.min.js.LICENSE.txt'), `tesseract-${OCR_VERSION}/worker.min.js.LICENSE.txt`)
  add(path.join(ocrRoot, 'LICENSE.md'), `tesseract-${OCR_VERSION}/LICENSE.md`)
  for (const name of fs.readdirSync(coreRoot)) if (/^tesseract-core.*\.wasm(?:\.js)?$/.test(name)) add(path.join(coreRoot, name), `tesseract-${OCR_VERSION}/core/${name}`)
  add(path.join(coreRoot, 'LICENSE'), `tesseract-${OCR_VERSION}/core/LICENSE`)
  add(path.join(englishRoot, '4.0.0_best_int/eng.traineddata.gz'), `tesseract-${OCR_VERSION}/lang/eng.traineddata.gz`)
  add(path.join(englishRoot, 'README.md'), `tesseract-${OCR_VERSION}/lang/README.md`)
  return assets
}

export function supplierOcrAssetsPlugin(): Plugin {
  let assets: LocalAsset[] = []
  let base = '/'
  return {
    name: 'supplier-local-ocr-assets',
    configResolved(config) { base = config.base; assets = supplierOcrAssets() },
    configureServer(server) {
      const files = new Map(assets.map(asset => [new URL(`${base}${asset.name}`, 'http://local.invalid').pathname, asset.filename]))
      server.middlewares.use((request, response, next) => {
        let pathname: string
        try { pathname = new URL(request.url || '/', 'http://local.invalid').pathname } catch { next(); return }
        const filename = files.get(pathname)
        if (!filename) { next(); return }
        if (!['GET', 'HEAD'].includes(request.method || 'GET')) { response.statusCode = 405; response.end(); return }
        const contentType = /\.(?:m?js)$/.test(filename) ? 'text/javascript' : filename.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream'
        response.setHeader('Content-Type', contentType)
        response.setHeader('Content-Length', fs.statSync(filename).size)
        response.setHeader('Cache-Control', 'no-cache')
        response.setHeader('X-Content-Type-Options', 'nosniff')
        if (request.method === 'HEAD') { response.end(); return }
        const stream = fs.createReadStream(filename)
        stream.on('error', () => { response.destroy() }); stream.pipe(response)
      })
    },
    generateBundle() { for (const asset of assets) this.emitFile({ type: 'asset', fileName: asset.name, source: fs.readFileSync(asset.filename) }) },
  }
}
