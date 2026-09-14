import { Check, Code2 } from 'lucide-react'

import type { TeamMember } from '@/components/about/about-data'
import { AnimateIn } from '@/components/landing/motion'

interface ExecutiveSpotlightProps {
  member: TeamMember
}

export function ExecutiveSpotlight({ member }: ExecutiveSpotlightProps) {
  return (
    <AnimateIn className="relative overflow-hidden rounded-xl border border-navy-800 bg-navy-800 text-white">
      <div className="relative flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-start lg:gap-8">
        <div className="relative mx-auto shrink-0 lg:mx-0">
          {member.image ? (
            <img
              src={member.image}
              alt={member.name}
              className="size-24 rounded-full object-cover object-top ring-1 ring-white/20"
            />
          ) : (
            <div className="flex size-24 items-center justify-center rounded-full bg-navy-900 text-2xl font-medium text-white ring-1 ring-white/20">
              {member.initials}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-navy-100">
            <Code2 className="size-3.5" />
            Technology leadership
          </span>

          <h3 className="mt-4 text-xl font-medium tracking-tight md:text-2xl">
            {member.name}
          </h3>
          <p className="mt-1 text-xs font-medium text-white md:text-sm">{member.role}</p>
          {member.roleDetail ? (
            <p className="mt-0.5 text-xs text-navy-200 md:text-sm">{member.roleDetail}</p>
          ) : null}

          <div className="mt-4 space-y-3">
            {member.bio.map((paragraph, index) => (
              <p
                key={paragraph.slice(0, 32)}
                className={
                  index === 0
                    ? 'text-sm leading-relaxed text-white md:text-base'
                    : 'text-sm leading-relaxed text-navy-100'
                }
              >
                {paragraph}
              </p>
            ))}
          </div>

          {member.focusAreas?.length ? (
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-navy-200">
                {member.focusLabel ?? 'Focus areas'}
              </p>
              <ul className="mt-3 space-y-2">
                {member.focusAreas.map((area) => (
                  <li
                    key={area}
                    className="flex items-start gap-2 text-xs leading-relaxed text-navy-100 md:text-sm"
                  >
                    <Check className="mt-0.5 size-3.5 shrink-0 text-navy-200" />
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </AnimateIn>
  )
}
