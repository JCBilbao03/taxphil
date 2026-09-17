export interface PublicGuide {
  id: string
  category: 'Getting started' | 'Company records' | 'Government services'
  title: string
  summary: string
  readMinutes: number
  sections: { heading: string; text: string; checklist?: string[] }[]
  source?: { label: string; url: string }
  action: { label: string; to: string }
}

export const publicGuides: PublicGuide[] = [
  {
    id: 'organize-company-books', category: 'Company records', title: 'A practical starting point for your company books',
    summary: 'Set up your company, assign responsibilities, and establish a clear path from source documents to reports.', readMinutes: 3,
    sections: [
      { heading: 'Begin with your company profile', text: 'Open UBB Accounting and create your company or join with an invitation. Review the registered name, TIN, address, registration details, and financial year before recording transactions. Your company code identifies the workspace; an invitation is also required to join.' },
      { heading: 'Give each person an appropriate role', text: 'An Admin manages company access. Accounting Managers review and post entries. Accountants prepare entries for independent approval. Viewers can read the records without changing them. Keep individual user accounts so the audit history can identify who did what.' },
      { heading: 'Build a repeatable monthly routine', text: 'Work from supporting documents and review your records before closing a period.', checklist: ['Record customer invoices and supplier bills with clear references.', 'Review prepared transactions and resolve differences before approval.', 'Record actual receipts and payments against outstanding documents.', 'Review the ledger, trial balance, and financial reports.', 'Export your records and retain the supporting documents.'] },
      { heading: 'Keep accounting and filing evidence together', text: 'A posted transaction records an accounting event. It does not prove that a government return was submitted or paid. Keep official filing acknowledgments and payment evidence with your reviewed obligations.' },
    ], action: { label: 'Open UBB Accounting', to: '/accounting/overview' },
  },
  {
    id: 'first-consultation', category: 'Getting started', title: 'Make your first accounting conversation useful',
    summary: 'A short preparation guide to help you explain your situation and get a clear next step.', readMinutes: 2,
    sections: [
      { heading: 'Start with the decision you need to make', text: 'Describe what you want help with: organizing existing records, starting a business, reviewing an obligation, or improving reporting. Mention your business activities, the period involved, and any notice or deadline you have received.' },
      { heading: 'Prepare a small set of useful records', text: 'Have the following available for your discussion. Share only the information needed for the question.', checklist: ['Your registration details and current taxpayer profile.', 'The relevant invoice, return, notice, or accounting report.', 'A short list of questions, ordered by urgency.', 'What has already been filed, paid, or discussed with an agency.'] },
      { heading: 'Agree the next step', text: 'Ask who will do the work, what documents are needed, the expected scope, and how any service fee will be confirmed. A consultation request is not a confirmed booking until the team responds.' },
    ], action: { label: 'Contact the TaxPhil team', to: '/connect' },
  },
  {
    id: 'dti-business-name', category: 'Government services', title: 'Finding your way through DTI business name registration',
    summary: 'Where to find the official registration workflow, your reference code, and certificate retrieval instructions.', readMinutes: 2,
    sections: [
      { heading: 'Use the official registration guide', text: 'The DTI Business Name Registration System guide covers a new business name application, certificate download, renewal, certification requests, and payment. Begin with the transaction that matches your situation.' },
      { heading: 'Keep your reference code', text: 'DTI assigns a reference code during the application. Keep it with your registration records; the guide explains how it is used for transaction inquiry and certificate retrieval.' },
      { heading: 'Review before confirming', text: 'Check the owner information, business name, territorial scope, address, and email before proceeding. Follow the official portal for current requirements, payment instructions, and confirmation.' },
      { heading: 'Plan the remaining setup', text: 'Ask your advisor which other registrations and permits apply to your business. Keep each agency’s confirmation separately so your records show exactly what has been completed.' },
    ], source: { label: 'DTI BNRS registration guide', url: 'https://bnrs.dti.gov.ph/resources/registration-guide' }, action: { label: 'Discuss business setup', to: '/connect' },
  },
  {
    id: 'sec-online-services', category: 'Government services', title: 'Understand the roles of eSECURE and eFAST',
    summary: 'A starting point for finding SEC account guidance and company report submission resources.', readMinutes: 2,
    sections: [
      { heading: 'Start with your SEC account', text: 'eSECURE provides an account and identity credentialing process for access to SEC online services. Its official page provides registration instructions, accepted identification guidance, manuals, and a video tutorial.' },
      { heading: 'Find the relevant reporting workflow', text: 'The SEC lists eFAST among the services accessed through eSECURE. Review the instructions inside the SEC portals for the report you intend to submit and keep the resulting submission evidence with your company records.' },
      { heading: 'Use current agency instructions', text: 'Account linking and service requirements can change. Check the official announcements before beginning. Company report requirements and deadlines must be reviewed for your entity and reporting period.' },
    ], source: { label: 'SEC eSECURE official guidance', url: 'https://esecure.sec.gov.ph/' }, action: { label: 'Watch official tutorials', to: '/media/videos' },
  },
]

export interface PublicVideo {
  id: string
  agency: 'DTI' | 'SEC'
  title: string
  description: string
  youtubeId: string
  sourceUrl: string
  takeaways: string[]
}

// Video IDs come from embeds on the linked official agency pages, reviewed 2026-09-17.
export const publicVideos: PublicVideo[] = [
  { id: 'dti-registration', agency: 'DTI', title: 'Register a business name online', description: 'The video linked in DTI’s official BNRS registration guide.', youtubeId: 'FOnpl3ui3uI', sourceUrl: 'https://bnrs.dti.gov.ph/resources/registration-guide', takeaways: ['Navigate the new business name registration process.', 'Use the written official guide alongside the video.', 'Keep your application reference and confirmation records.'] },
  { id: 'sec-esecure', agency: 'SEC', title: 'Getting started with eSECURE', description: 'The account tutorial published on the SEC eSECURE website.', youtubeId: 'znrGdsGAqNQ', sourceUrl: 'https://esecure.sec.gov.ph/', takeaways: ['Find the SEC account registration and credentialing guidance.', 'Review the current identity requirements on the official page.', 'Locate manuals and announcements for SEC online services.'] },
  { id: 'dti-renewal', agency: 'DTI', title: 'Renew a business name registration', description: 'The renewal walkthrough linked in DTI’s BNRS guide.', youtubeId: '-tESI-U9ikc', sourceUrl: 'https://bnrs.dti.gov.ph/resources/registration-guide', takeaways: ['Locate the business name renewal workflow.', 'Review the registration details before confirming.', 'Retain renewal and payment confirmations.'] },
]
