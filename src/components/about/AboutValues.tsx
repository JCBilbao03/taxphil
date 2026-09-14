import { aboutValues } from '@/components/about/about-data'
import { SectionHeading } from '@/components/about/SectionHeading'
import { HoverLift, StaggerGroup, StaggerItem } from '@/components/landing/motion'
import { Card } from '@/components/ui/card'

export function AboutValues() {
  return (
    <section
      id="values"
      className="scroll-mt-32 border-y border-border bg-muted/30 py-16 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Our principles"
          title="What we stand for"
          description="The values that guide how we build TaxPhil and support our customers"
        />

        <StaggerGroup fast className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {aboutValues.map(({ id, icon: Icon, title, description }) => (
            <StaggerItem key={id}>
              <HoverLift lift={4} className="h-full rounded-lg">
                <Card className="group h-full bg-card p-6">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-150 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 text-base font-medium text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </Card>
              </HoverLift>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  )
}
