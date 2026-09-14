import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { expertiseItems } from '@/components/about/about-data'
import { SectionHeading } from '@/components/about/SectionHeading'
import { HoverLift, StaggerGroup, StaggerItem } from '@/components/landing/motion'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function AboutExpertise() {
  return (
    <section
      id="expertise"
      className="scroll-mt-32 border-t border-border bg-muted/30 py-16 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="How we help"
          title="Expertise you can put to work today"
          description="From your first free consultation to ongoing compliance support — pick the level of help you need"
        />

        <StaggerGroup fast className="mt-14 grid gap-6 sm:grid-cols-2">
          {expertiseItems.map(
            ({ id, icon: Icon, title, description, href, linkLabel, highlight }) => (
              <StaggerItem key={id}>
                <HoverLift lift={4} className="h-full rounded-lg">
                  <Card
                    className={cn(
                      'h-full bg-card p-6 md:p-8',
                      highlight && 'border-primary ring-1 ring-primary/20',
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className={cn(
                          'flex size-11 items-center justify-center rounded-lg',
                          highlight
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      {highlight ? (
                        <Badge className="bg-muted text-foreground hover:bg-muted">
                          No cost
                        </Badge>
                      ) : null}
                    </div>

                    <h3 className="mt-5 text-lg font-medium tracking-tight text-foreground">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </p>

                    <Link
                      to={href}
                      className="group mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      {linkLabel}
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Card>
                </HoverLift>
              </StaggerItem>
            ),
          )}
        </StaggerGroup>
      </div>
    </section>
  )
}
