import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import { supplierOcrAssets } from '../scripts/supplier-ocr-assets-plugin.ts'

test('local asset manifest contains PDF worker/fonts, OCR engine variants and compressed English data', () => {
  const assets = supplierOcrAssets()
  assert.equal(new Set(assets.map(asset => asset.name)).size, assets.length)
  assert.ok(assets.every(asset => asset.name.startsWith('supplier-ocr/') && !asset.name.includes('..') && existsSync(asset.filename)))
  assert.ok(assets.some(asset => asset.name.endsWith('/pdf.worker.min.mjs')))
  assert.ok(assets.some(asset => asset.name.includes('/cmaps/')))
  assert.ok(assets.some(asset => asset.name.includes('/standard_fonts/')))
  assert.ok(assets.some(asset => asset.name.includes('/wasm/')))
  for (const variant of ['', '-simd', '-relaxedsimd', '-lstm', '-simd-lstm', '-relaxedsimd-lstm']) {
    for (const extension of ['.wasm', '.wasm.js']) assert.ok(assets.some(asset => asset.name === `supplier-ocr/tesseract-7.0.0/core/tesseract-core${variant}${extension}`))
  }
  const language = assets.find(asset => asset.name.endsWith('/lang/eng.traineddata.gz'))
  assert.ok(language)
  assert.ok(statSync(language.filename).size > 1_000_000)
  assert.ok(assets.some(asset => asset.name.endsWith('/worker.min.js.LICENSE.txt')))
})
