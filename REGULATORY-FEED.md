# Philippine regulatory source feed

The company Regulatory Library combines company-maintained reference records with a shared discovery feed. A discovery never changes tax mappings, accounting books, dates, rates, return drafts or company compliance statuses. Adding a discovery to a company library is an explicit Admin/Manager action; it leaves the company review date and effective date blank.

`dailyRegulatorySync` is a Firebase scheduled function configured for **08:00 Asia/Manila daily**. It was deployed to `philtax` on 17 September 2026 and its Scheduler job is enabled. The first production check discovered 311 BIR issuances across RR, RMC and RMO; SEC returned HTTP 403 and is marked for manual review. See `DEPLOYMENT.md`. The UI says that checks have not started until source-state documents exist. No success or freshness is inferred from an empty collection.

## Verified source scope

Verified on 17 September 2026:

- [BIR Revenue Issuances](https://www.bir.gov.ph/revenue-issuances-details): current and previous-year Revenue Regulations, Revenue Memorandum Circulars and Revenue Memorandum Orders linked by the official index. The official site renders these through public dataset content on `https://bir-cms-ws.bir.gov.ph/api/pub/templates/{numeric-template}/datasets`. Template identifiers are read from that listing's public Next.js page metadata; they are not hardcoded. The public headers `client-website-id: 2` and `Origin: https://www.bir.gov.ph` match the site's published loader. Active listing content, issued dates, subjects, issuance numbers and explicit **Full Text** PDF links are extracted. Digests and annexes are not substituted for full text. The current-year RR listing and its full-text links were inspected successfully.
- [SEC homepage](https://www.sec.gov.ph/): recent **Memorandum Circular** announcements, then their official detail pages. Draft consultations are excluded. A single official PDF is retained when unambiguous; otherwise the official article is retained. The SEC homepage was verified through official indexed content, but direct automated requests returned HTTP 403 / a challenge page during this task. This is recorded as a failed check, not bypassed or represented as current.

Coverage is limited to those listings. It does not cover every BIR issuance category, every SEC issuance, all other agencies, local ordinances, or industry-specific pronouncements. The SEC homepage is a recent-announcements source, not a full archival register. The first sync imports existing discovered documents; **first detected** is not a claim about legal publication or effectivity. Newly uploaded replacements at the same URL are not detected unless their listing metadata changes; no PDF-content interpretation occurs.

## Persistence and failure behavior

- Shared `regulatoryUpdates/{sha256(sourceId + URL)}` records retain `firstSeenAt`, update `lastSeenAt`, and record `lastChangedAt` when listing metadata changes. They stay `needs_review`. Existing documents are retained when a listing no longer shows them.
- `regulatorySync/{sourceId}` records keep the last attempt, last successful check, last failure, source URL, result count and error. A failed source does not erase its last success or another source's successful discoveries.
- Discovery is idempotent across scheduler retries. A partial source run can persist discovered links before a later persistence failure; the source's successful-check time is advanced only after that source completes.
- Fetches use a fixed official-host allowlist, exact public BIR API path validation, HTTPS, no credentials, no ports, no redirects, timeouts and a 4 MB response limit. Page contents are parsed as untrusted text and never executed. Unexpected layouts, incomplete datasets, zero supported documents and response errors require manual review and cannot advance the last-success timestamp.
- Company reference/task changes remain validated and version-checked by `companyWorkflowSave`. Uploaded evidence uses private company storage access. The feed stores only public issuance metadata and official links.

## Verification

Pure parser fixtures cover BIR listing extraction, dataset/Next metadata, official-domain restrictions, current/prior-year index selection, invalid dates, SEC draft filtering and PDF ambiguity. A stubbed scheduler test verifies source isolation, preserved last-success timestamps, no success for zero supported records, retained discoveries, stable first detection and retry deduplication. These tests do not fetch live sites or write to production.
