# Vendor and customer directory

Every new vendor and customer requires a registered name, TIN, and registered address. Optional email, internal notes, and vendor default withholding ATC can be saved. Admins, Accounting Managers and Accountants can create, edit, archive and reactivate records. Viewers can read them.

TIN input accepts the 9-digit base with an optional legacy 3-digit or current 5-digit branch. The normalized index uses all 14 digits, with an omitted branch saved as 00000. This checks formatting, not BIR registration or taxpayer identity. Records are unique by company, kind and normalized TIN. An entity may be both vendor and customer, and different companies have isolated directories. Archived records retain the TIN reservation and should be reactivated rather than duplicated.

`companyPartySave({id?, expectedVersion, value})` writes `companies/{companyId}/parties/{id}` and its `partyTinIndex/{kind}_{normalizedTin}` atomically. The company comes from verified current membership. Updates check the previous version, keep the party kind immutable, and append a company audit event. Clients cannot write either collection directly.

The invoice/bill entry form selects an active saved customer/vendor. Registered name, TIN and address fill from that record. New company invoices include the party ID and a snapshot of these fields; later directory edits do not rewrite historical invoices. Payment dialogs show the TIN stored on the original document. Legacy books without a party ID remain readable and parseable. Isolated legacy browser fixtures without a company context retain manual fields.

The root release integration adds company routes, Firestore read rules, and server-side invoice/withholding lookup. It must derive party fields from the same-company directory, rather than trust browser-provided TIN values. `useCompanyParties(kind?)` and `PartyDirectory({kind})` are the shared frontend interfaces.

Validation: five pure model/ledger tests and five real callable handler tests with local Auth/Firestore doubles cover required fields, normalization, immutable document snapshots, permissions, tenant isolation, duplicates, archive behavior, revision conflicts, index moves and audit entries. These do not replace Firebase Rules emulator or live integration checks. No production records were created and no deployment was performed.
