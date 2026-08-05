import { Award, Clock, FileWarning, TrendingUp } from 'lucide-react'

import { certifications } from '@/components/about/about-data'
import { AnimateIn, StaggerGroup, StaggerItem } from '@/components/landing/motion'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

const painPoints = [
  {
    icon: Clock,
    title: 'Hours lost to manual work',
    description: 'Spreadsheets, receipts, and re-typing the same figures into BIR forms.',
  },
  {
    icon: FileWarning,
    title: 'Uncertainty about requirements',
    description: 'Not knowing which forms, deadlines, or deductions actually apply to you.',
  },
  {
    icon: TrendingUp,
    title: 'No visibility on tax dues',
    description: 'Surprise tax bills because nothing is computed until filing season.',
  },
] as const

export function AboutMission() {
  return (
    <section id="mission" className="scroll-mt-32 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <AnimateIn>
              <Badge
                variant="outline"
                className="mb-4 border-primary/20 bg-primary/5 text-primary"
              >
                Our mission
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                Filing taxes should not feel like a second full-time job
              </h2>
              <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
                <p>
                  Too many business owners lose hours to manual calculations, missed
                  deadlines, and uncertainty about which forms apply to them. The
                  rules are public, but making sense of them takes training most
                  taxpayers never had a reason to get.
                </p>
                <p>
                  We started TaxPhil to change that. Our mission is to give every
                  Filipino taxpayer — from first-time freelancers to established SMEs
                  — a trusted, accredited platform where filing, paying, and staying
                  compliant takes minutes instead of days.
                </p>
              </div>
            </AnimateIn>

            <StaggerGroup fast className="mt-10 space-y-4">
              {painPoints.map(({ icon: Icon, title, description }) => (
                <StaggerItem key={title}>
                  <div className="flex gap-4 rounded-xl border border-border bg-muted/30 p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>

          <div className="lg:col-span-5">
            <AnimateIn delay={0.1} className="lg:sticky lg:top-32">
              <Card className="bg-gradient-to-br from-primary/[0.06] via-white to-white p-8 shadow-md">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Award className="size-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
                  Trusted &amp; accredited
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  TaxPhil meets the standards Philippine taxpayers expect from a
                  serious compliance partner — accredited for electronic filing and
                  built on secure, audited infrastructure.
                </p>
                <ul className="mt-6 space-y-2.5">
                  {certifications.map((cert) => (
                    <li
                      key={cert}
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-foreground shadow-sm"
                    >
                      <span
                        className="size-1.5 rounded-full bg-emerald-500"
                        aria-hidden="true"
                      />
                      {cert}
                    </li>
                  ))}
                </ul>
              </Card>
            </AnimateIn>
          </div>
        </div>
      </div>
    </section>
  )
}
