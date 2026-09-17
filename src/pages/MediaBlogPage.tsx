import { useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, ExternalLink, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ButtonLink } from '@/components/landing/ButtonLink'
import { publicGuides } from '@/lib/public-resources'

export function MediaBlogPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All guides')
  const selected = publicGuides.find(guide => guide.id === params.get('article'))
  const categories = ['All guides', 'Getting started', 'Company records', 'Government services']
  const filtered = publicGuides.filter(guide => (category === 'All guides' || guide.category === category) && `${guide.title} ${guide.summary} ${guide.category}`.toLowerCase().includes(query.trim().toLowerCase()))

  if (selected) return (
    <div className="bg-slate-50 text-slate-900">
      <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <Link to="/media/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft className="size-4" />All guides</Link>
        <p className="mt-10 text-sm font-semibold text-blue-700">{selected.category}</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{selected.title}</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">{selected.summary}</p>
        <p className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Clock3 className="size-4" />{selected.readMinutes} min read · TaxPhil practical guide</p>
        <div className="mt-9 space-y-8 rounded-xl border border-slate-200 bg-white p-6 md:p-9">{selected.sections.map(section => <section key={section.heading}><h2 className="text-xl font-semibold">{section.heading}</h2><p className="mt-3 leading-8 text-slate-600">{section.text}</p>{section.checklist && <ul className="mt-4 space-y-3">{section.checklist.map(item => <li key={item} className="flex gap-3 text-sm leading-7 text-slate-600"><Check className="mt-1 size-4 shrink-0 text-blue-600" />{item}</li>)}</ul>}</section>)}</div>
        {selected.source && <aside className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-6"><p className="font-semibold text-blue-900">Official reference</p><a href={selected.source.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700 underline underline-offset-4">{selected.source.label}<ExternalLink className="size-4" /></a><p className="mt-3 text-sm leading-6 text-slate-600">Reference reviewed 17 September 2026. Use the agency’s current instructions for your transaction.</p></aside>}
        <div className="mt-8 flex flex-wrap gap-3"><ButtonLink to={selected.action.to}>{selected.action.label}<ArrowRight className="size-4" /></ButtonLink><ButtonLink to="/media/blog" variant="outline">Browse more guides</ButtonLink></div>
      </article>
    </div>
  )

  return (
    <div className="bg-slate-50 text-slate-900">
      <section className="border-b border-blue-900 bg-[#103d72] text-white"><div className="mx-auto max-w-6xl px-6 py-14 md:py-20"><p className="text-sm font-semibold tracking-widest text-blue-200 uppercase">TaxPhil learning hub</p><h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Good records start with understanding.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-blue-100">Practical guides to using your workspace and navigating official Philippine business resources.</p><div className="mt-7 flex flex-wrap gap-5 text-sm"><span className="border-b-2 border-white pb-2 font-semibold">Guides &amp; articles</span><Link to="/media/videos" className="pb-2 text-blue-200 hover:text-white">Video tutorials →</Link></div></div></section>
      <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
        {params.has('article') && <p role="status" className="mb-5 rounded-lg border border-slate-200 bg-white p-4 text-sm">That guide could not be found. Browse the available guides below.</p>}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2" aria-label="Guide categories">{categories.map(value => <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)} className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${category === value ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400'}`}>{value}</button>)}</div><label className="relative"><Search className="absolute top-3.5 left-3.5 size-4 text-slate-400" /><span className="sr-only">Search guides</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search guides" className="h-11 w-full rounded-lg border border-slate-200 bg-white pr-4 pl-10 text-sm lg:w-64" /></label></div>
        <p role="status" className="mt-6 text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? 'guide' : 'guides'}</p>
        <div className="mt-5 grid gap-6 md:grid-cols-2">{filtered.map(guide => <article key={guide.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-7"><div className="flex items-center justify-between"><div className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><BookOpen className="size-5" /></div><span className="text-xs font-medium text-slate-500">{guide.readMinutes} min read</span></div><p className="mt-6 text-sm font-medium text-blue-700">{guide.category}</p><h2 className="mt-2 text-xl font-semibold leading-7">{guide.title}</h2><p className="mt-3 flex-1 text-sm leading-7 text-slate-600">{guide.summary}</p><button type="button" className="mt-7 inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-700 hover:underline" onClick={() => { setParams({ article: guide.id }); window.scrollTo({ top: 0, behavior: 'instant' }) }}>Read guide<ArrowRight className="size-4" /></button></article>)}</div>
        {filtered.length === 0 && <div className="rounded-xl border border-slate-200 bg-white p-10 text-center"><h2 className="text-lg font-semibold">No guides match your search</h2><p className="mt-2 text-sm text-slate-500">Try a different topic or clear your filters.</p><button className="mt-5 text-sm font-semibold text-blue-700" onClick={() => { setQuery(''); setCategory('All guides') }}>Clear filters</button></div>}
        <div className="mt-10 flex flex-col gap-5 rounded-xl bg-[#103d72] p-7 text-white sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">Looking for a regulation?</h2><p className="mt-2 text-sm leading-6 text-blue-100">Find official issuances and company compliance tools in your accounting workspace.</p></div><ButtonLink to="/accounting/library" className="shrink-0 bg-white text-blue-800 hover:bg-blue-50">Open regulatory library<ArrowRight className="size-4" /></ButtonLink></div>
      </div>
    </div>
  )
}
