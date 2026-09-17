import { readBankWorkbook } from './bank-statement-import'

self.onmessage = async (event: MessageEvent<{ bytes: ArrayBuffer; fileName: string }>) => {
  try {
    const tables = await readBankWorkbook(event.data.bytes, event.data.fileName)
    self.postMessage({ tables })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'This workbook could not be read.' })
  }
}
