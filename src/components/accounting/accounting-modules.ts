import { ArrowDownToLine, Banknote, BookOpen, ChartColumn, Database, FilePenLine, Home, ListTree, ReceiptText, Users, Building2, ShieldCheck, ClipboardCheck, History } from 'lucide-react'

export const accountingModules = [
  ['overview', 'Overview', Home, 'Understand your numbers. Know what to do next.'],
  ['journal', 'Journal Entry', FilePenLine, 'Record opening balances and adjustments. Every entry stays in your audit trail.'],
  ['ledger', 'General Ledger', BookOpen, 'Follow the activity and running balance of each account.'],
  ['payable', 'Accounts Payable', ReceiptText, 'Track supplier bills, due dates, and payments in one place.'],
  ['receivable', 'Accounts Receivable', Users, 'See what customers owe you and record money received.'],
  ['disbursements', 'Cash Disbursement Book', Banknote, 'A clear record of money paid out of cash and bank accounts.'],
  ['receipts', 'Cash Receipt Book', ArrowDownToLine, 'A clear record of money received into cash and bank accounts.'],
  ['accounts', 'Chart of Accounts', ListTree, 'Organize the accounts that make up your business books.'],
  ['reports', 'Financial Reports', ChartColumn, 'Turn your recorded transactions into a clear financial picture.'],
  ['approvals', 'Approvals', ClipboardCheck, 'Review prepared transactions before they reach your books.'],
  ['compliance', 'Philippine Compliance', ShieldCheck, 'Review obligations against your company registration and current official guidance.'],
  ['company', 'Company Profile', Building2, 'Registration, tax treatment, and financial reporting settings.'],
  ['team', 'Users & Roles', Users, 'Manage company membership and access.'],
  ['audit', 'Audit Trail', History, 'A record of company activity and accounting approvals.'],
  ['settings', 'Books & Backups', Database, 'Protect your records, manage accounting periods, and find guidance.'],
] as const
