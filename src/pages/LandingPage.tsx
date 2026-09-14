import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileCheck,
  LineChart,
  MessageCircle,
  Smartphone,
  Upload,
} from 'lucide-react'

import { HeroBackground } from '@/components/landing/HeroBackground'
import {
  AnimateIn,
  HoverLift,
  MotionOnMount,
  StaggerGroup,
  StaggerItem,
  fadeUp,
} from '@/components/landing/motion'
import { PaymentMarquee } from '@/components/landing/PaymentMarquee'
import { OnlineServicesSection } from '@/components/landing/OnlineServicesSection'
import { ButtonLink } from '@/components/landing/ButtonLink'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { landingSectionPath } from '@/lib/landing-sections'
import { cn } from '@/lib/utils'

const certifications = ['BIR eFPS Accredited', 'ISO 27001 Certified', 'DTI Registered']

const plans = [
  {
    id: 'business-registration',
    name: 'Business Registration',
    description:
      'Register your business with DTI, SEC, or LGU. We handle the paperwork and compliance setup so you can focus on running your business.',
    price: '2,000',
    period: 'one-time',
    startsAt: true,
    highlight: false,
  },
  {
    id: 'accountant-retainers',
    name: 'Accountant Retainers',
    description:
      'Ongoing accounting support from licensed professionals — bookkeeping, financial reports, and compliance monitoring.',
    price: '500',
    period: 'per month',
    startsAt: false,
    highlight: false,
  },
  {
    id: 'fractional-cfo',
    name: 'Fractional CFO',
    description:
      'Senior finance leadership on demand — financial oversight, multi-tiered reporting, strategic guidance, and CFO-level advisory without a full-time hire.',
    price: '2,500',
    period: 'per month',
    startsAt: true,
    highlight: false,
  },
  {
    id: 'tax-consultation',
    name: 'Free Tax Consultation',
    description:
      'Expert advice on BIR compliance, tax planning, and filing requirements tailored to your business or profession.',
    price: 'Free',
    period: 'per session',
    startsAt: false,
    highlight: true,
    badge: 'Start here — no cost',
    cta: 'Book free consultation',
  },
] as const

const features = [
  {
    icon: CreditCard,
    title: 'Multiple Payment Channels',
    description:
      'Skip the lines and pay conveniently through GCash, Maya, bank transfer, and more.',
  },
  {
    icon: Smartphone,
    title: 'Pay Your Taxes on the Go',
    description:
      'Access your account 24/7 and file, manage, and pay taxes wherever you are.',
  },
  {
    icon: FileCheck,
    title: 'Auto-Generated Tax Forms',
    description:
      'Say goodbye to complicated BIR forms. Your 1701Q, 2551Q, and attachments are filled in one click.',
  },
  {
    icon: LineChart,
    title: 'Real-time Tax Calculation',
    description:
      'No more tax bill shock. TaxPhil shows your updated tax dues in real time as you log income and expenses.',
  },
  {
    icon: Upload,
    title: 'Submission of Attachments',
    description:
      'Automatically create relevant QAP, SAWT, and SLSP attachments for each filing period.',
  },
  {
    icon: Calendar,
    title: 'Deadline Reminders',
    description:
      'Never miss a BIR deadline. Get clear alerts for upcoming filings and payment due dates.',
  },
] as const

const paymentChannels = [
  'GCash',
  'Maya',
  'BDO',
  'BPI',
  'Metrobank',
  'UnionBank',
  'PayPal',
  'Landbank',
] as const

const steps = [
  {
    step: '01',
    title: 'Create your free account',
    description: 'Sign up in minutes with your TIN and taxpayer details.',
  },
  {
    step: '02',
    title: 'Log income & expenses',
    description: 'Track receipts and invoices — TaxPhil computes your dues automatically.',
  },
  {
    step: '03',
    title: 'File & pay in one click',
    description: 'Review auto-generated BIR forms, submit electronically, and pay online.',
  },
] as const

const heroStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
}

export function LandingPage() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="min-h-svh bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-background">
        <HeroBackground />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <motion.div
            className="mx-auto max-w-3xl text-center"
            initial={prefersReducedMotion ? 'visible' : 'hidden'}
            animate="visible"
            variants={heroStagger}
          >
            <motion.div variants={fadeUp}>
              <Badge
                variant="outline"
                className="mb-6 border-primary/20 bg-primary/5 text-primary"
              >
                Accredited online tax filing for the Philippines
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl font-medium tracking-tight text-foreground md:text-5xl lg:text-6xl"
            >
              File &amp; Pay Your Taxes in Minutes
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
            >
              TaxPhil is an accredited online tax filing tool in the Philippines.
              We help freelancers, self-employed professionals, small business owners,
              and corporations file and pay their taxes from wherever, whenever.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mx-auto mt-8 max-w-xl rounded-lg border border-border bg-card p-6"
            >
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:text-left">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <MessageCircle className="size-5" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-sm font-medium text-foreground">
                    Free tax consultation for every new user
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Talk to a licensed tax expert about BIR compliance, filing, and planning —
                    no commitment, no credit card required.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <ButtonLink
                size="lg"
                to="/connect"
                className="group h-12 px-8 text-base"
              >
                Get your free consultation
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </ButtonLink>
              <ButtonLink
                size="lg"
                variant="outline"
                to={landingSectionPath('free-consultation')}
                className="h-12 px-8 text-base"
              >
                See how it works
              </ButtonLink>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-14">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Certified by
              </p>
              <StaggerGroup fast className="mt-4 flex flex-wrap items-center justify-center gap-3">
                {certifications.map((cert) => (
                  <StaggerItem key={cert}>
                    <motion.span
                      className="inline-block rounded-md border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground"
                    >
                      {cert}
                    </motion.span>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Free tax consultation promo */}
      <section
        id="free-consultation"
        className="scroll-mt-32 border-b border-border bg-navy-900 py-16 text-white md:py-20"
      >
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
            <div>
              <Badge className="mb-4 border-white/15 bg-white/10 text-white hover:bg-white/10">
                100% free — no strings attached
              </Badge>
              <h2 className="text-3xl font-medium tracking-tight md:text-4xl">
                Not sure where to start with your taxes?
              </h2>
              <p className="mt-4 text-base leading-relaxed text-navy-100">
                Book a free one-on-one session with our tax experts. We&apos;ll review
                your situation, answer BIR questions, and show you how TaxPhil can
                simplify filing — whether you&apos;re a freelancer, sole proprietor, or
                small business owner.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Licensed professionals who know Philippine tax law',
                  'Personalized advice for your business or profession',
                  'Walkthrough of TaxPhil — try the app during your session',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-navy-100">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-navy-200" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink
                  size="lg"
                  to="/connect"
                  className="h-12 bg-card px-8 text-base text-primary hover:bg-navy-50"
                >
                  Claim your free consultation
                  <ArrowRight className="ml-1 size-4" />
                </ButtonLink>
                <ButtonLink
                  size="lg"
                  variant="outline"
                  to={landingSectionPath('plans')}
                  className="h-12 border-white/30 bg-transparent px-8 text-base text-white hover:bg-white/10"
                >
                  View all services
                </ButtonLink>
              </div>
            </div>

            <HoverLift lift={4}>
              <Card className="border-white/10 bg-white/5 text-white">
                <CardHeader>
                  <CardTitle className="text-xl text-white">What you get</CardTitle>
                  <CardDescription className="text-navy-200">
                    A focused session built around your tax questions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    {
                      title: 'BIR compliance check',
                      detail: 'Understand what forms and deadlines apply to you.',
                    },
                    {
                      title: 'Tax planning tips',
                      detail: 'Learn legitimate ways to reduce stress and stay compliant.',
                    },
                    {
                      title: 'Live app demo',
                      detail: 'See filing and payment in action inside TaxPhil.',
                    },
                  ].map(({ title, detail }) => (
                    <div
                      key={title}
                      className="rounded-lg border border-white/10 bg-white/5 p-4"
                    >
                      <p className="font-medium text-white">{title}</p>
                      <p className="mt-1 text-sm text-navy-200">{detail}</p>
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                  <p className="text-center text-2xl font-semibold text-white sm:text-left">
                    Free
                    <span className="ml-2 text-sm font-normal text-navy-200">
                      per session
                    </span>
                  </p>
                </CardFooter>
              </Card>
            </HoverLift>
          </AnimateIn>
        </div>
      </section>

      {/* Online Services — BIR forms catalog (Taxumo-style) */}
      <OnlineServicesSection />

      {/* Plans */}
      <section id="plans" className="scroll-mt-32 py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-medium tracking-tight md:text-4xl">
              Services Offered
            </h2>
            <p className="mt-4 text-muted-foreground">
              Professional tax and accounting services to help you register,
              comply, and grow your business.
            </p>
          </AnimateIn>

          <StaggerGroup className="mt-14 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <StaggerItem key={plan.id}>
                <HoverLift>
                  <Card
                    className={cn(
                      'flex h-full flex-col',
                      plan.highlight && 'border-primary ring-1 ring-primary/20',
                    )}
                  >
                    <CardHeader>
                      {plan.highlight ? (
                        <Badge className="mb-2 w-fit bg-primary text-primary-foreground">
                          {'badge' in plan ? plan.badge : 'Most popular'}
                        </Badge>
                      ) : null}
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription className="leading-relaxed">
                        {plan.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      {plan.startsAt ? (
                        <p className="text-sm text-muted-foreground">Starts at</p>
                      ) : null}
                      <p className="mt-1 text-3xl font-semibold tracking-tight text-primary">
                        {plan.price === 'Free' ? 'Free' : `\u20B1${plan.price}`}
                      </p>
                      <p className="text-sm text-muted-foreground">{plan.period}</p>
                    </CardContent>
                    <CardFooter>
                      <ButtonLink
                        variant={plan.highlight ? 'default' : 'outline'}
                        className="w-full"
                        to={plan.id === 'tax-consultation' ? '/connect' : '/dashboard'}
                      >
                        {'cta' in plan ? plan.cta : 'Learn more'}
                      </ButtonLink>
                    </CardFooter>
                  </Card>
                </HoverLift>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <AnimateIn delay={0.2} className="mt-10 text-center text-sm text-muted-foreground">
            <Link
              to={landingSectionPath('online-services')}
              className="group font-medium text-primary hover:underline"
            >
              View our online BIR filing services
              <ArrowRight className="ml-1 inline size-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </AnimateIn>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="scroll-mt-32 border-y border-border bg-muted/30 py-20 md:py-24"
      >
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-medium tracking-tight md:text-4xl">
              Why choose TaxPhil?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Learn the benefits of our trusted tax compliance platform
            </p>
          </AnimateIn>

          <StaggerGroup fast className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <StaggerItem key={title}>
                <HoverLift lift={4}>
                  <Card className="group h-full border-border/60 bg-card">
                    <CardHeader>
                      <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-150 group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="size-5" />
                      </div>
                      <CardTitle className="text-base">{title}</CardTitle>
                      <CardDescription className="leading-relaxed">
                        {description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </HoverLift>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-32 py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-medium tracking-tight md:text-4xl">
              How TaxPhil Works
            </h2>
            <p className="mt-4 text-muted-foreground">
              Get started in three simple steps — no tax expertise required
            </p>
          </AnimateIn>

          <StaggerGroup className="relative mt-14 grid gap-8 md:grid-cols-3">
            <div
              className="absolute top-8 right-[16.67%] left-[16.67%] hidden h-px bg-border md:block"
              aria-hidden="true"
            />

            {steps.map(({ step, title, description }) => (
              <StaggerItem key={step}>
                <div className="relative text-center md:text-left">
                  <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
                    className="inline-block text-5xl font-medium tracking-tight text-navy-200"
                  >
                    {step}
                  </motion.span>
                  <h3 className="mt-4 text-lg font-medium text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <AnimateIn delay={0.15} variant="scaleIn">
            <motion.div
              className="mx-auto mt-16 max-w-3xl rounded-xl border border-navy-800 bg-navy-900 p-8 text-center text-white md:p-12"
            >
              <h3 className="text-xl font-medium tracking-tight">
                Still unsure about how TaxPhil works?
              </h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-navy-200">
                Whether you decide to use TaxPhil or not — we&apos;re happy to run a
                live walkthrough for free. Pick a date and join our live sessions
                today.
              </p>
              <div className="mt-6">
                <Button
                  size="lg"
                  variant="secondary"
                  className="bg-card text-primary hover:bg-navy-50"
                >
                  Join free live demo
                </Button>
              </div>
            </motion.div>
          </AnimateIn>
        </div>
      </section>

      {/* Payment channels */}
      <section className="overflow-hidden py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-medium tracking-tight md:text-4xl">
              Our trusted payment channels
            </h2>
            <p className="mt-4 text-muted-foreground">
              Partners that secure your tax payments
            </p>
          </AnimateIn>

          <AnimateIn delay={0.15} className="mt-12">
            <PaymentMarquee items={paymentChannels} />
          </AnimateIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-border bg-navy-900 py-20 text-white md:py-24">
        <MotionOnMount className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-medium tracking-tight md:text-4xl">
            Sign up and get your free tax consultation
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-navy-200">
            Create your account in minutes and talk to a licensed tax expert —
            then file and pay with the premier online tax tool for Philippine
            professionals and small businesses.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <ButtonLink
              size="lg"
              variant="secondary"
              to="/connect"
              className="h-12 bg-card px-8 text-base text-primary transition-colors hover:bg-navy-50"
            >
              Get free consultation
            </ButtonLink>
            <ButtonLink
              size="lg"
              variant="outline"
              to={landingSectionPath('how-it-works')}
              className="h-12 border-white/30 bg-transparent px-8 text-base text-white transition-colors hover:bg-white/10 hover:text-white"
            >
              Join free live demo
            </ButtonLink>
          </div>
        </MotionOnMount>
      </section>
    </div>
  )
}
