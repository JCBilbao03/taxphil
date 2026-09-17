import { useState } from 'react'
import { ArrowRight, Building2, ExternalLink, FileText, Percent, Receipt, Search, Users } from 'lucide-react'
import { ButtonLink } from '@/components/landing/ButtonLink'

type ServiceCategory =
  | 'all'
  | 'income-tax'
  | 'percentage-vat'
  | 'withholding'
  | 'corporate'

type FilingFrequency = 'Monthly' | 'Quarterly' | 'Annual'

interface OnlineService {
  id: string
  form: string
  title: string
  description: string
  audience: string
  frequency: FilingFrequency
  category: Exclude<ServiceCategory, 'all'>
}

const categories: { id: ServiceCategory; label: string; icon: typeof FileText }[] = [
  { id: 'all', label: 'All services', icon: FileText },
  { id: 'income-tax', label: 'Income tax', icon: Receipt },
  { id: 'percentage-vat', label: 'Percentage & VAT', icon: Percent },
  { id: 'withholding', label: 'Withholding tax', icon: Users },
  { id: 'corporate', label: 'Corporate', icon: Building2 },
]

const onlineServices: OnlineService[] = [
  {
    id: '1701q',
    form: '1701Q',
    title: 'Quarterly Income Tax Return',
    description:
      'For self-employed individuals, freelancers, professionals, and sole proprietors reporting quarterly income.',
    audience: 'Self-employed & professionals',
    frequency: 'Quarterly',
    category: 'income-tax',
  },
  {
    id: '1701a',
    form: '1701A',
    title: 'Annual Income Tax Return',
    description:
      'Annual ITR for taxpayers under the 8% flat tax rate or Optional Standard Deduction (OSD).',
    audience: 'Freelancers & sole proprietors',
    frequency: 'Annual',
    category: 'income-tax',
  },
  {
    id: '1701',
    form: '1701',
    title: 'Annual Income Tax Return (Itemized)',
    description:
      'For individuals with mixed income sources or those using the itemized deduction method.',
    audience: 'Mixed-income earners',
    frequency: 'Annual',
    category: 'income-tax',
  },
  {
    id: '1700',
    form: '1700',
    title: 'Annual Income Tax Return (Multiple Employers)',
    description:
      'For individuals earning purely compensation income who are required to file an annual return.',
    audience: 'Employees',
    frequency: 'Annual',
    category: 'income-tax',
  },
  {
    id: '2551q',
    form: '2551Q',
    title: 'Quarterly Percentage Tax Return',
    description:
      'For non-VAT registered businesses paying percentage tax on gross sales or receipts.',
    audience: 'Non-VAT businesses',
    frequency: 'Quarterly',
    category: 'percentage-vat',
  },
  {
    id: '2550q',
    form: '2550Q',
    title: 'Quarterly VAT Return',
    description:
      'For VAT-registered taxpayers to report output VAT, input VAT, and net VAT payable.',
    audience: 'VAT-registered businesses',
    frequency: 'Quarterly',
    category: 'percentage-vat',
  },
  {
    id: '0619-e',
    form: '0619-E',
    title: 'Monthly Expanded Withholding Tax',
    description:
      'Remittance of expanded withholding tax for the applicable months covered by this form.',
    audience: 'Withholding agents',
    frequency: 'Monthly',
    category: 'withholding',
  },
  {
    id: '1601-c',
    form: '1601-C',
    title: 'Monthly Compensation Withholding Tax',
    description:
      'Monthly remittance of taxes withheld on compensation paid to employees.',
    audience: 'Employers',
    frequency: 'Monthly',
    category: 'withholding',
  },
  {
    id: '1601eq',
    form: '1601EQ',
    title: 'Quarterly Expanded Withholding Tax',
    description:
      'Quarterly summary of expanded withholding taxes withheld during the quarter.',
    audience: 'Withholding agents',
    frequency: 'Quarterly',
    category: 'withholding',
  },
  {
    id: '1702q',
    form: '1702Q',
    title: 'Quarterly Corporate Income Tax',
    description:
      'Quarterly income tax reporting for corporations, partnerships, and other applicable non-individual taxpayers.',
    audience: 'Corporations & partnerships',
    frequency: 'Quarterly',
    category: 'corporate',
  },
  {
    id: '1702-rt',
    form: '1702-RT',
    title: 'Annual Corporate Income Tax',
    description:
      'Annual income tax return for corporations using the regular corporate income tax rate.',
    audience: 'Corporations',
    frequency: 'Annual',
    category: 'corporate',
  },
]

export function OnlineServicesSection() {
  const [category, setCategory] = useState<ServiceCategory>('all')
  const [query, setQuery] = useState('')
  const filtered = onlineServices.filter(service => (category === 'all' || category === service.category) && `${service.form} ${service.title} ${service.audience}`.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <section id="online-services" className="scroll-mt-24 border-y border-slate-200 bg-white py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-sm font-semibold text-blue-700">PHILIPPINE TAX PREPARATION</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Find the form. Understand the next step.</h2>
        <p className="mt-4 max-w-2xl leading-7 text-slate-600">Explore common BIR forms, organize your records, and review your obligations. Use the official BIR instructions to confirm the form, filing channel, and deadline that apply to you.</p>
        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2" aria-label="Form categories">{categories.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-pressed={category === id} onClick={() => setCategory(id)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium ${category === id ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400'}`}><Icon className="size-4" />{label}</button>)}</div><label className="relative"><Search className="absolute top-3.5 left-3 size-4 text-slate-400" /><span className="sr-only">Search BIR forms</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search form or purpose" className="h-11 w-full rounded-lg border border-slate-200 bg-white pr-4 pl-9 text-sm lg:w-60" /></label></div>
        <p role="status" className="mt-5 text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? 'form' : 'forms'} found</p>
        <div className="mt-5 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(service => <details key={service.id} className="group rounded-xl border border-slate-200 bg-slate-50/50 open:bg-white"><summary className="cursor-pointer p-5"><span className="mb-3 inline-flex rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-800">{service.form}</span><span className="block text-base font-semibold leading-6 text-slate-900">{service.title}</span><span className="mt-2 block text-xs text-slate-500">{service.frequency} · View details</span></summary><div className="border-t border-slate-100 p-5"><p className="text-sm leading-7 text-slate-600">{service.description}</p><p className="mt-3 text-xs leading-6 text-slate-500">Applies depending on your registration and circumstances: {service.audience}.</p><div className="mt-4 space-y-3"><ButtonLink to="/tax-dues" size="sm" className="w-full justify-between">Review tax preparation<ArrowRight className="size-4" /></ButtonLink><a href="https://www.bir.gov.ph/bir-forms" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-sm font-medium text-blue-700">Find {service.form} on BIR<ExternalLink className="size-4" /></a></div></div></details>)}</div>
        {filtered.length === 0 && <div className="mt-5 rounded-xl border border-slate-200 p-8 text-center"><p className="text-slate-600">No matching forms. Try another form number or category.</p><button className="mt-4 text-sm font-semibold text-blue-700" onClick={() => { setQuery(''); setCategory('all') }}>Clear filters</button></div>}
        <div className="mt-8 flex flex-col gap-4 rounded-xl border border-blue-100 bg-blue-50 p-6 md:flex-row md:items-center md:justify-between"><p className="max-w-2xl text-sm leading-7 text-slate-600">Preparing a return in TaxPhil does not submit it to BIR. Complete filing and payment through your applicable official channel, then keep the acknowledgment with your records.</p><ButtonLink to="/connect" variant="outline" className="shrink-0 bg-white">Ask the team<ArrowRight className="size-4" /></ButtonLink></div>
      </div>
    </section>
  )
}
