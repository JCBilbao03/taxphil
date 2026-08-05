import { StaggerGroup, StaggerItem } from '@/components/landing/motion'
import { milestones, type Milestone } from '@/components/about/about-data'
import { useCountUp } from '@/hooks/useCountUp'

function MilestoneValue({ milestone }: { milestone: Milestone }) {
  const { ref, value } = useCountUp(milestone.value ?? 0)

  if (milestone.display) {
    return <span className="tabular-nums">{milestone.display}</span>
  }

  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString('en-US')}
      {milestone.suffix}
    </span>
  )
}

export function AboutStats() {
  return (
    <section aria-label="TaxPhil by the numbers" className="relative z-10 -mt-20 md:-mt-24">
      <div className="mx-auto max-w-6xl px-6">
        <StaggerGroup
          fast
          className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-xl shadow-navy-900/5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {milestones.map((milestone) => (
            <StaggerItem key={milestone.id} className="bg-white">
              <div className="flex h-full flex-col items-center gap-2 px-6 py-8 text-center">
                <milestone.icon className="size-5 text-primary/40" />
                <p className="text-3xl font-semibold tracking-tight text-primary md:text-4xl">
                  <MilestoneValue milestone={milestone} />
                </p>
                <p className="text-sm text-muted-foreground">{milestone.label}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  )
}
