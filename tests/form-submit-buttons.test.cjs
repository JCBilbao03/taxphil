const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readdirSync, readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const ts = require('typescript')

// Base UI Button defaults to type="button", unlike a plain HTML button.
// An action inside a form therefore needs an explicit type or its own click handler.
test('form Buttons explicitly declare their action instead of silently ignoring submission', () => {
  const root = resolve(__dirname, '../src'), missing = []
  for (const name of readdirSync(root, { recursive: true }).filter(name => name.endsWith('.tsx'))) {
    const source = ts.createSourceFile(name, readFileSync(resolve(root, name), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    function visit(node, inForm = false) {
      const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
      const tag = opening?.tagName.getText(source), inside = inForm || tag === 'form'
      if (inside && tag === 'Button' && !opening.attributes.properties.some(attribute => ['type', 'onClick'].includes(attribute.name?.getText(source)))) {
        missing.push(`${name}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`)
      }
      ts.forEachChild(node, child => visit(child, inside))
    }
    visit(source)
  }
  assert.deepEqual(missing, [], `These form actions will not submit when clicked because Base UI defaults to type="button": ${missing.join(', ')}`)
})
