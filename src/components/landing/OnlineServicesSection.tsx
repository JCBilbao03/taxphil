import { useCallback, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Building2,
  CalendarClock,
  FileText,
  Percent,
  Receipt,
  Users,
} from 'lucide-react'

import { ButtonLink } from '@/components/landing/ButtonLink'
import {
  AnimateIn,
  HoverLift,
  StaggerGroup,
  StaggerItem,
} from '@/components/landing/motion'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { landingSectionPath } from '@/lib/landing-sections'
import { cn } from '@/lib/utils'

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
  deadline: string
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
    deadline: '60 days after each quarter',
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
    deadline: 'April 15 each year',
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
    deadline: 'April 15 each year',
    category: 'income-tax',
  },
  {
    id: '1700',
    form: '1700',
    title: 'Annual Income Tax Return (Multiple Employers)',
    description:
      'For employees with multiple employers who need to file due to refund claims or additional tax due.',
    audience: 'Employees',
    frequency: 'Annual',
    deadline: 'April 15 each year',
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
    deadline: '25 days after each quarter',
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
    deadline: '25 days after each quarter',
    category: 'percentage-vat',
  },
  {
    id: '0619-e',
    form: '0619-E',
    title: 'Monthly Expanded Withholding Tax',
    description:
      'Monthly remittance return for expanded/creditable withholding taxes withheld on payments.',
    audience: 'Withholding agents',
    frequency: 'Monthly',
    deadline: '10th of the following month',
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
    deadline: '10th of the following month',
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
    deadline: '30 days after each quarter',
    category: 'withholding',
  },
  {
    id: '1702q',
    form: '1702Q',
    title: 'Quarterly Corporate Income Tax',
    description:
      'Quarterly income tax return for corporations and partnerships using CREATE law rates.',
    audience: 'Corporations & partnerships',
    frequency: 'Quarterly',
    deadline: '60 days after each quarter',
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
    deadline: 'April 15 each year',
    category: 'corporate',
  },
]

const frequencyStyles: Record<FilingFrequency, string> = {
  Monthly: 'bg-deadline-warning-bg text-deadline-warning border-deadline-warning/20',
  Quarterly: 'bg-primary/10 text-primary border-primary/20',
  Annual: 'bg-deadline-safe-bg text-deadline-safe border-deadline-safe/20',
}

const EASE = [0.21, 0.47, 0.32, 0.98] as [number, number, number, number]

export function OnlineServicesSection() {
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>('all')
  const prefersReducedMotion = useReducedMotion()

  const handleCategoryChange = useCallback((category: ServiceCategory) => {
    setActiveCategory(category)
  }, [])

  const filtered =
    activeCategory === 'all'
      ? onlineServices
      : onlineServices.filter((service) => service.category === activeCategory)

  return (
    <section
      id="online-services"
      className="scroll-mt-32 border-b border-border bg-white py-20 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <AnimateIn className="mx-auto max-w-2xl text-center">
          <Badge
            variant="outline"
            className="mb-4 border-primary/20 bg-primary/5 text-primary"
          >
            BIR-accredited eTSP
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Online Services
          </h2>
          <p className="mt-4 text-muted-foreground">
            File and pay BIR tax forms online. TaxPhil auto-computes, generates,
            and submits the correct form — no manual eBIRForms required.
          </p>
        </AnimateIn>

        {/* Category filters */}
        <AnimateIn delay={0.1} className="mt-10">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {categories.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleCategoryChange(id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300',
                  activeCategory === id
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-white text-muted-foreground hover:border-primary/30 hover:text-foreground',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </AnimateIn>

        {/* Service cards */}
        <div className="mt-12">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeCategory}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <StaggerGroup fast className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((service) => (
                  <StaggerItem key={service.id}>
                    <HoverLift lift={5}>
                      <Card className="group flex h-full flex-col border-border/80 shadow-sm transition-colors hover:border-primary/20">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                              {service.form}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                'shrink-0 text-xs',
                                frequencyStyles[service.frequency],
                              )}
                            >
                              {service.frequency}
                            </Badge>
                          </div>
                          <CardTitle className="mt-3 text-base leading-snug">
                            {service.title}
                          </CardTitle>
                          <CardDescription className="leading-relaxed">
                            {service.description}
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="flex-1 space-y-3 pb-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="size-3.5 shrink-0" />
                            <span>{service.audience}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CalendarClock className="size-3.5 shrink-0" />
                            <span>Due: {service.deadline}</span>
                          </div>
                        </CardContent>

                        <CardFooter className="border-t border-border/60 bg-muted/20 pt-4">
                          <ButtonLink
                            variant="ghost"
                            size="sm"
                            to="/dashboard"
                            className="group/btn w-full justify-between text-primary hover:bg-primary/5 hover:text-primary"
                          >
                            File online
                            <ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-1" />
                          </ButtonLink>
                        </CardFooter>
                      </Card>
                    </HoverLift>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom CTA strip — mirrors Taxumo marketplace / help prompt */}
        <AnimateIn delay={0.2} variant="scaleIn">
          <div className="mt-14 rounded-xl border border-border bg-muted/40 p-6 text-center md:p-8">
            <p className="text-sm font-medium text-foreground">
              Not sure which form you need to file?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              TaxPhil detects your taxpayer type and automatically prepares the
              correct BIR forms based on your logged transactions.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink to="/dashboard" className="gap-2">
                Start filing for free
                <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink variant="outline" to={landingSectionPath('how-it-works')}>
                See how it works
              </ButtonLink>
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  )
}
