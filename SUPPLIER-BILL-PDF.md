# Supplier bill source PDFs

`Invoice.supplierBillPdf` is optional and is retained through preparation, approval, posting, settlement, reversal, and validated backup restoration. Only payable bills may contain this field. Existing bills without it remain readable and can still be posted.

```ts
{
  path: 'companies/{companyId}/supplier-bills/{fileId}',
  name: 'Supplier invoice.pdf',
  size: 4096,
  type: 'application/pdf'
}
```

- Upload using Firebase Storage with `contentType: 'application/pdf'` before submitting `companyAccountingCommand` with `type: 'addInvoice'`. Omit the attachment if there is none. Extra metadata fields, including URLs, are rejected.
- Company ID and file ID allow 1–128 letters, digits, underscores, or hyphens. Use a random UUID as the file ID, without a filename extension. The filename must be a basename ending in `.pdf` (case insensitive), at most 200 characters, with no slash, backslash, or control character. Byte size must be an integer between 1 and 10 MiB (10,485,760 bytes).
- `validateSupplierBillPdf` and `MAX_SUPPLIER_BILL_PDF_BYTES` are available from the browser accounting module for client validation. The server applies the same validator, enforces the authenticated company, and verifies actual Storage metadata: exact path, PDF content type, and exact size.
- Verification runs before both initial posting/preparation and approval. A document removed or changed by a privileged server after preparation blocks approval. Reviewers can still reject that draft. Downloading or parsing file contents is not part of authorization; MIME verification does not certify the document’s contents or tax validity.
- The supplier PDF Storage path allows creation only by verified active company administrators, managers, and accountants. Both the global membership and company member record must be active and agree on role. Active company viewers may read. Objects cannot be overwritten, updated, or deleted through client rules. Existing compliance evidence paths are preserved.
- Display/download through the authenticated Firebase SDK. Do not store public download URLs in accounting records. No upload, payment, or production deployment was executed for validation.

Validation: `tests/supplier-bill-pdf.test.ts` (4 pure engine and restore tests), `functions/tests/supplier-bill-pdf.test.cjs` (8 real callable handler tests with Auth/Firestore/Storage doubles), plus existing accounting and company/party regression tests. Backend tests cover foreign paths, wrong invoice kind, invalid metadata, missing objects, exact size/MIME/name checks, both approval stages, legacy records, fresh identity, and role restrictions. Storage rules need deployment with the application and functions; they have not been run against a Storage emulator in this workspace.

## Reading and review in Add supplier bill

The form reads text PDFs with PDF.js and raster/scanned pages with local English Tesseract OCR. Engines, workers and trained data are emitted as same-origin build assets; source documents are not sent to an external OCR API. Reading is lazy and cancellable, with 10-page/10-MiB limits, page/render/text bounds and timeouts. Unsupported, encrypted or unreadable documents show a correction path. A selected valid PDF may still be attached when the user enters and reviews the bill manually.

Recognized invoice reference, unambiguous dates, goods/services description and explicitly PHP gross total fill the form. The supplier is selected only through an active company vendor TIN match. The directory supplies the canonical name, TIN and address; extraction cannot create or modify vendors. Missing/ambiguous values, credit notes, foreign currencies, conflicting totals and VAT inconsistencies require review. One expense account and one tax classification are supported per bill; extraction does not allocate mixed-tax line items.

Manual edits are preserved during reading. A replacement PDF clears prior untouched suggestions before reading so a failed replacement cannot retain the old invoice values. Missing dates remain blank. Select the expense account and check the original-document review box before submitting. Changing bill fields or live vendor identity invalidates that review. Saving locks editing and dismissal while the source PDF uploads; failed submission retains the uploaded attachment for retry. Source links appear on the posted bill, payment dialog and pending approval detail.

Browser acceptance fixtures are fictional: `tests/fixtures/supplier-bills/text-invoice.pdf` and `scanned-invoice.pdf`. `tests/workflows-browser.html#/accounting/payable` is a development-only preview that holds test files in memory and performs no production writes.
