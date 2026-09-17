import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AccountingWorkspace } from '../src/pages/AccountingPage'
import { AccountingShell } from '../src/components/accounting/AccountingShell'
import '../src/index.css'

// Temporary browser fixture. This UID is never a Firebase account.
if (!import.meta.env.DEV) throw Error('Development fixture only')
const uid = 'isolated-ui-validation-20260916'
const createURL = URL.createObjectURL.bind(URL)
URL.createObjectURL = (blob: Blob | MediaSource) => {
  if (blob instanceof Blob) void blob.text().then(text => { document.getElementById('last-export')!.textContent = text })
  return createURL(blob)
}
createRoot(document.getElementById('test-root')!).render(
  <div>
    <HashRouter><AccountingShell userName="QA Tester"><Routes><Route path="*" element={<AccountingWorkspace uid={uid} />} /><Route path="accounting/:module" element={<AccountingWorkspace uid={uid} />} /></Routes></AccountingShell></HashRouter>
    <details className="mt-8"><summary>Last test export</summary><pre id="last-export" className="whitespace-pre-wrap" /></details>
  </div>,
)
