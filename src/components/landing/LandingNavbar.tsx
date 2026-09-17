import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { ButtonLink } from '@/components/landing/ButtonLink'
import { cn } from '@/lib/utils'

const navigation = [
  { to: '/#online-services', label: 'Services' },
  { to: '/accounting/overview', label: 'UBB Accounting' },
  { to: '/about', label: 'About us' },
  { to: '/media/blog', label: 'Guides' },
  { to: '/media/videos', label: 'Videos' },
]

export function LandingNavbar() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 border-b border-blue-900/20 bg-[#103d72] text-white">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-6">
        <Link to="/" onClick={() => setOpen(false)} className="flex shrink-0 items-center gap-2.5" aria-label="TaxPhil home"><span className="flex size-9 items-center justify-center rounded-lg bg-white text-sm font-bold text-blue-800">TP</span><span className="text-xl font-semibold tracking-tight">TaxPhil<span className="text-blue-300">.</span></span></Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">{navigation.map(link => <NavLink key={link.to} to={link.to} className={({ isActive }) => `text-sm font-medium transition-colors hover:text-white ${isActive && link.to !== '/#online-services' ? 'text-white underline decoration-blue-300 underline-offset-8' : 'text-blue-100'}`}>{link.label}</NavLink>)}</nav>
        <div className="flex items-center gap-3"><Link to="/login" className="hidden text-sm font-medium text-blue-100 hover:text-white sm:block">Log in</Link><ButtonLink to="/signup" size="sm" className="bg-white text-blue-800 hover:bg-blue-50">Get started</ButtonLink><button aria-expanded={open} aria-controls="public-mobile-navigation" aria-label={open ? 'Close navigation' : 'Open navigation'} onClick={() => setOpen(!open)} className="rounded-md p-2 hover:bg-white/10 lg:hidden">{open ? <X className="size-5" /> : <Menu className="size-5" />}</button></div>
      </div>
      {open && <nav id="public-mobile-navigation" aria-label="Mobile navigation" className="border-t border-white/15 px-6 py-4 lg:hidden">{[...navigation, { to: '/login', label: 'Log in' }, { to: '/help', label: 'Help & account information' }].map(link => <Link key={link.to} to={link.to} onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 text-sm text-blue-50 hover:bg-white/10">{link.label}</Link>)}</nav>}
    </header>
  )
}

export function LandingFooter({ className }: { className?: string }) {
  const groups = [
    { title: 'Your workspace', links: [{ label: 'UBB Accounting', to: '/accounting/overview' }, { label: 'Income & expenses', to: '/income-expenses' }, { label: 'Tax dues', to: '/tax-dues' }, { label: 'Permit assistance', to: '/permits' }] },
    { title: 'Learn & explore', links: [{ label: 'Practical guides', to: '/media/blog' }, { label: 'Official video tutorials', to: '/media/videos' }, { label: 'Regulatory library', to: '/accounting/library' }, { label: 'How it works', to: '/#how-it-works' }] },
    { title: 'People & support', links: [{ label: 'About TaxPhil', to: '/about' }, { label: 'Contact our team', to: '/connect' }, { label: 'Data & account help', to: '/help' }, { label: 'Account settings', to: '/settings' }] },
  ]
  return (
    <footer className={cn('border-t border-slate-200 bg-white text-slate-900', className)}><div className="mx-auto max-w-6xl px-6 py-12"><div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"><div><Link to="/" className="flex items-center gap-2.5"><span className="flex size-9 items-center justify-center rounded-lg bg-blue-700 text-sm font-bold text-white">TP</span><span className="text-xl font-semibold">TaxPhil.</span></Link><p className="mt-5 max-w-xs text-sm leading-7 text-slate-500">A clearer workspace for your business records, accounting, and Philippine compliance preparation.</p><Link to="/connect" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">Let’s talk<ArrowUpRight className="size-4" /></Link></div>{groups.map(group => <div key={group.title}><p className="text-sm font-semibold">{group.title}</p><ul className="mt-5 space-y-3 text-sm text-slate-500">{group.links.map(link => <li key={link.to}><Link to={link.to} className="hover:text-blue-700">{link.label}</Link></li>)}</ul></div>)}</div><div className="mt-10 flex flex-col gap-3 border-t border-slate-100 pt-6 text-xs leading-6 text-slate-500 sm:flex-row sm:justify-between"><p>© {new Date().getFullYear()} TaxPhil. All rights reserved.</p><p>Built for Philippine businesses.</p></div></div></footer>
  )
}
