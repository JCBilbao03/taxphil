import type { TeamMember } from '@/components/about/about-data'
import { HoverLift } from '@/components/landing/motion'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

interface TeamMemberCardProps {
  member: TeamMember
}

export function TeamMemberCard({ member }: TeamMemberCardProps) {
  return (
    <HoverLift lift={4} className="h-full rounded-xl">
      <Card className="h-full bg-white p-6 shadow-sm md:p-8">
        <div className="flex h-full flex-col gap-5">
          {member.image ? (
            <img
              src={member.image}
              alt={member.name}
              className="size-16 shrink-0 rounded-2xl object-cover object-top"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-semibold text-primary">
              {member.initials}
            </div>
          )}

          <div className="flex flex-1 flex-col">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              {member.name}
            </h3>
            <p className="mt-1 text-sm font-medium text-primary">{member.role}</p>
            {member.roleDetail ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{member.roleDetail}</p>
            ) : null}

            <div className="mt-4 space-y-3">
              {member.bio.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className="text-sm leading-relaxed text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {member.focusAreas?.length ? (
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {member.focusLabel ?? 'Focus areas'}
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {member.focusAreas.map((area) => (
                    <li key={area}>
                      <Badge
                        variant="outline"
                        className="border-border bg-muted/50 font-normal text-muted-foreground"
                      >
                        {area}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </HoverLift>
  )
}
