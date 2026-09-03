import { Network } from 'lucide-react'

import { advisors, executives, founder } from '@/components/about/about-data'
import { ExecutiveSpotlight } from '@/components/about/ExecutiveSpotlight'
import { FounderSpotlight } from '@/components/about/FounderSpotlight'
import { SectionHeading } from '@/components/about/SectionHeading'
import { TeamMemberCard } from '@/components/about/TeamMemberCard'
import { AnimateIn, StaggerGroup, StaggerItem } from '@/components/landing/motion'

export function AboutLeadership() {
  return (
    <section id="leadership" className="scroll-mt-32 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Leadership & advisory"
          title="Meet the people behind TaxPhil"
          description="Licensed finance professionals and technologists committed to making tax compliance easier for Philippine businesses"
        />

        <div className="mt-14">
          <FounderSpotlight member={founder} />
        </div>

        <div className="mt-10">
          {executives.map((member) => (
            <ExecutiveSpotlight key={member.id} member={member} />
          ))}
        </div>

        <AnimateIn className="mt-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Network className="size-3.5 text-primary" />
            Advisory network
          </span>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Fractional CFO associates
          </h3>
          <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Senior finance leaders who extend our advisory capacity for clients that
            need strategic, CFO-level support without a full-time hire.
          </p>
        </AnimateIn>

        <StaggerGroup className="mt-10 grid gap-6 md:grid-cols-2">
          {advisors.map((member) => (
            <StaggerItem key={member.id}>
              <TeamMemberCard member={member} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  )
}
