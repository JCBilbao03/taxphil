import { Link, Outlet } from 'react-router-dom'
import { BookOpen, CheckCircle2, Users } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-blue-900/20 bg-[#103d72] px-6 py-4 text-white"><Link to="/" className="flex items-center gap-2.5"><span className="flex size-9 items-center justify-center rounded-lg bg-white text-sm font-bold text-blue-800">TP</span><span className="text-xl font-semibold tracking-tight">TaxPhil.</span></Link><Link to="/help" className="text-sm text-blue-100 hover:text-white">Need help?</Link></header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 lg:grid-cols-2 lg:gap-20"><div className="hidden lg:block"><p className="text-sm font-semibold text-blue-700">YOUR BUSINESS WORKSPACE</p><h1 className="mt-5 max-w-md text-4xl font-semibold leading-tight tracking-tight text-slate-900">A clearer view of what comes next.</h1><p className="mt-5 max-w-md text-base leading-8 text-slate-600">Keep your records organized, collaborate with your team, and prepare for your Philippine business obligations.</p><div className="mt-8 space-y-5">{[{ icon: BookOpen, title: 'Your records in one place' }, { icon: Users, title: 'Roles that fit your company' }, { icon: CheckCircle2, title: 'A clear review and approval process' }].map(({ icon: Icon, title }) => <div key={title} className="flex items-center gap-3 text-sm text-slate-600"><span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon className="size-4" /></span>{title}</div>)}</div></div><div className="mx-auto w-full max-w-md"><Outlet /></div></main>
      <footer className="px-6 py-5 text-center text-xs text-slate-500">© {new Date().getFullYear()} TaxPhil. <Link to="/help" className="ml-2 text-blue-700">Data &amp; account help</Link></footer>
    </div>
  )
}
