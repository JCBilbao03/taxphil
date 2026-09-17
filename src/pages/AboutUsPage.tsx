import { ArrowRight, BookOpen, Building2, Check, HeartHandshake, Layers3, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { advisors, executives, founder, type TeamMember } from '@/components/about/about-data'
import { ButtonLink } from '@/components/landing/ButtonLink'

const principles = [
  { icon: ShieldCheck, title: 'Care in every record', text: 'Clear records, accountable approvals, and a traceable history of the work behind your numbers.' },
  { icon: HeartHandshake, title: 'People you can talk to', text: 'A direct connection to the team for questions about your business, your accounts, and your next steps.' },
  { icon: BookOpen, title: 'Clarity at every step', text: 'Plain-language explanations and official references that help you understand what needs attention.' },
  { icon: Building2, title: 'A Philippine perspective', text: 'Company profiles and workflows shaped around the way Philippine businesses register, keep records, and report.' },
]

function TeamProfile({ member, featured = false }: { member: TeamMember; featured?: boolean }) {
  return (
    <article className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${featured ? 'grid md:grid-cols-[240px_1fr]' : ''}`}>
      <div className={`relative bg-slate-100 ${featured ? 'h-80 md:h-[340px]' : 'h-64'}`}>
        {member.image ? <img src={member.image} alt={member.name} loading="lazy" className="h-full w-full object-cover object-top" /> : <div className="flex h-full items-center justify-center text-5xl text-blue-700">{member.initials}</div>}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/20 to-transparent" aria-hidden="true" />
      </div>
      <div className="p-6 md:p-8">
        <p className="text-sm font-semibold text-blue-700">{member.role}</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{member.name}</h3>
        {member.credentials && <div className="mt-3 flex flex-wrap gap-2">{member.credentials.map(c => <span key={c} className="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">{c}</span>)}</div>}
        {member.roleDetail && <p className="mt-2 text-sm text-slate-500">{member.roleDetail}</p>}
        <p className="mt-5 text-sm leading-7 text-slate-600">{member.bio[0]}</p>
        <details className="group mt-5 border-t border-slate-100 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">Full profile &amp; areas of focus</summary>
          {member.bio.slice(1).map(p => <p key={p} className="mt-4 text-sm leading-7 text-slate-600">{p}</p>)}
          {member.focusAreas && <ul className="mt-4 space-y-2">{member.focusAreas.map(a => <li key={a} className="flex gap-2 text-sm text-slate-600"><Check className="mt-0.5 size-4 shrink-0 text-blue-600" />{a}</li>)}</ul>}
          {member.quote && <blockquote className="mt-5 border-l-2 border-blue-600 pl-4 text-sm leading-7 text-slate-600">“{member.quote}”</blockquote>}
        </details>
      </div>
    </article>
  )
}

export function AboutUsPage() {
  return (
    <div className="bg-slate-50 text-slate-900">
      <section className="overflow-hidden bg-[#103d72] text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.3fr_1fr] md:items-center md:py-24">
          <div>
            <p className="text-sm font-semibold tracking-widest text-blue-200 uppercase">Meet TaxPhil</p>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">People behind clearer business finances.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-blue-100">We bring accounting, technology, and advisory experience together to help Philippine businesses move forward with confidence.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/connect" className="h-11 bg-white px-5 text-blue-800 hover:bg-blue-50">Talk to our team <ArrowRight className="size-4" /></ButtonLink>
              <ButtonLink to="/about#leadership" variant="outline" className="h-11 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">Meet the leadership</ButtonLink>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-7">
            <div className="flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-lg bg-white text-xl font-semibold text-blue-800">TP</div><div><p className="text-lg font-semibold">TaxPhil</p><p className="text-sm text-blue-200">People. Records. Perspective.</p></div></div>
            <div className="mt-7 space-y-4">
              {[
                { title: 'Accounting', text: 'Organized books and clearer reporting', icon: Layers3 },
                { title: 'Advisory', text: 'Financial experience behind your decisions', icon: Users },
                { title: 'Philippine focus', text: 'Context for your company and obligations', icon: Building2 },
              ].map(({ title, text, icon: Icon }) => <div key={title} className="flex gap-4 rounded-lg bg-white/5 p-4"><Icon className="mt-1 size-5 shrink-0 text-blue-200" /><div><p className="font-medium">{title}</p><p className="mt-1 text-sm leading-6 text-blue-100">{text}</p></div></div>)}
            </div>
          </div>
        </div>
      </section>
      <nav aria-label="About sections" className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-8 gap-y-3 px-6 py-5 text-sm font-medium text-slate-600">{[['mission', 'Our purpose'], ['values', 'Our approach'], ['leadership', 'Our people'], ['expertise', 'How we help']].map(([id, label]) => <Link key={id} to={`/about#${id}`} className="hover:text-blue-700">{label}</Link>)}</div>
      </nav>
      <section id="mission" className="mx-auto grid max-w-6xl scroll-mt-24 gap-8 px-6 py-16 md:grid-cols-2 md:py-20">
        <div><p className="text-sm font-semibold text-blue-700">OUR PURPOSE</p><h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight">Make room for the business you want to build.</h2></div>
        <div className="space-y-4 text-base leading-8 text-slate-600"><p>Keeping a business moving takes more than a set of numbers. It takes clear records, an understanding of your responsibilities, and people who can help you ask the right questions.</p><p>TaxPhil connects those parts in one place: day-to-day records, company accounting, Philippine regulatory references, and a way to speak with the team when you need guidance.</p></div>
      </section>
      <section id="values" className="scroll-mt-24 border-y border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6"><p className="text-sm font-semibold text-blue-700">OUR APPROACH</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Practical by design. Personal by nature.</h2><div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{principles.map(({ icon: Icon, title, text }) => <div key={title}><div className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon className="size-5" /></div><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{text}</p></div>)}</div></div>
      </section>
      <section id="leadership" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 md:py-20">
        <div className="mb-10"><p className="text-sm font-semibold text-blue-700">OUR PEOPLE</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Experience behind the platform.</h2><p className="mt-4 max-w-2xl leading-7 text-slate-600">Meet our founder, technology leadership, and financial advisors. Open each profile to explore their background and areas of focus.</p></div>
        <TeamProfile member={founder} featured />
        <div className="mt-6 grid gap-6 md:grid-cols-3">{[...executives, ...advisors].map(member => <TeamProfile key={member.id} member={member} />)}</div>
      </section>
      <section id="expertise" className="scroll-mt-24 border-t border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6"><p className="text-sm font-semibold text-blue-700">HOW WE HELP</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">A clearer next step for your business.</h2><div className="mt-9 grid gap-5 md:grid-cols-3">{[
          { title: 'Organize your accounts', text: 'Work with invoices, bills, journals, and reports in your company workspace.', to: '/accounting/overview', action: 'Open UBB Accounting' },
          { title: 'Understand the process', text: 'Explore practical guides and official resources for Philippine business administration.', to: '/media/blog', action: 'Explore the guides' },
          { title: 'Get a human perspective', text: 'Discuss your questions, accounting support, or a consultation with our team.', to: '/connect', action: 'Contact the team' },
        ].map(item => <Link to={item.to} key={item.title} className="group rounded-xl border border-slate-200 p-6 transition-colors hover:border-blue-400 hover:bg-blue-50/30"><h3 className="text-lg font-semibold">{item.title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{item.text}</p><span className="mt-5 flex items-center gap-2 text-sm font-semibold text-blue-700">{item.action}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span></Link>)}</div></div>
      </section>
    </div>
  )
}
