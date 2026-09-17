# Asset Tracking

The company asset register is available at `/accounting/assets`. Its server-owned records are separate from the general ledger; approved financial actions update the register and ledger atomically.

## Workflow

- Register an asset by allocating an existing, unreversed posted acquisition or opening entry, or prepare a new opening journal. Linking an existing acquisition does not post its purchase twice. Cost, accumulated depreciation and impairment allocations cannot exceed the corresponding source lines.
- Record code, description, category, serial number, acquisition/in-service/register dates, location and custodian. Custody fields contain names or internal references, not private employee registration identifiers.
- Configure separate book and tax policies explicitly. This release supports monthly straight-line or no automatic depreciation, with remaining useful life, residual value, schedule start and a recorded policy basis. No statutory useful life, tax eligibility or capitalization threshold is inferred.
- Prepare depreciation, custody transfer, impairment, whole-asset disposal, or a correction. A different Company Admin or Accounting Manager must review the action before it changes the register or books. Viewers can read the register but cannot prepare or review actions.
- Disposal uses a dedicated non-cash proceeds clearing account. Record the actual proceeds separately against that clearing account; disposal does not invent a receipt or duplicate a bank movement.
- Correct the latest effective asset action through a reviewed asset reversal. Generic journal reversal is blocked for linked acquisition sources and module journals so the register remains aligned with its ledger. Reverse dependent later asset actions first.
- Compare cost, accumulated depreciation, impairment and carrying value against linked ledger balances as of a selected date. Differences remain visible; manual ledger adjustments are not silently hidden.

## Tax connection

Posted book depreciation flows through the existing account-to-return mappings. The asset tax schedule separately shows company-configured tax depreciation and the book/tax difference. Newly prepared tax working papers retain the asset schedule, policies, asset versions and register revision; changes invalidate pending review. A difference is supporting evidence for a reviewed adjustment, not an automatic declaration that an amount is tax deductible.

## Controls and scope

Independent review, current book/register revisions, idempotent request IDs, source allocation limits, centavo rounding, residual-value limits, chronological events, closed accounting periods and bank reconciliation locks are enforced by the backend. Immutable action history and CSV schedules support review.

The register currently supports 100 retained assets per company, 100 assets per depreciation run and 100 pending asset actions. Each asset has a 1,000-event limit, with serialized document limits enforced before posting. The existing ledger remains limited to 2,000 entries and 650,000 serialized bytes. Account reclassification transfers, partial disposals and additional depreciation methods require separate implementation; custody transfers do not change financial accounts.

The source bill's retained PDF is available through its linked acquisition entry. A separate general-purpose asset attachment workflow is not yet provided. A new tax working paper is a supporting calculation and review record, not an official electronic BIR submission.

## Verification

Focused tests cover company isolation, current verified identity, roles, reviewed registration, duplicate acquisition prevention, allocation limits, stale versions, independent approval and retries, depreciation rounding/overlap, custody, impairment, disposal, correction, closed periods, reconciliation and asset tax snapshots. The development-only `/tests/assets-browser.html` page uses synthetic local records for UI review and is excluded from the production entry point. Production deployment status is recorded separately in `DEPLOYMENT.md`.
