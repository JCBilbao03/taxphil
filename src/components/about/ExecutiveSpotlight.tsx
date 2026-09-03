import { Check, Code2 } from 'lucide-react'

import type { TeamMember } from '@/components/about/about-data'
import { AnimateIn } from '@/components/landing/motion'

interface ExecutiveSpotlightProps {
  member: TeamMember
}

export function ExecutiveSpotlight({ member }: ExecutiveSpotlightProps) {
  return (
    <AnimateIn className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-600 via-navy-700 to-navy-800 text-white shadow-2xl shadow-navy-700/25">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-24 -right-20 size-80 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 size-80 rounded-full bg-navy-400/25 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_70%_60%_at_80%_20%,#000_45%,transparent_100%)]" />
      </div>

      <div className="relative flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-start lg:gap-8">
        <div className="relative mx-auto shrink-0 lg:mx-0">
          <div className="relative">
            <div
              className="absolute -inset-1 rounded-full bg-gradient-to-tr from-emerald-400/60 to-navy-200/60 blur-md"
              aria-hidden="true"
            />
            {member.image ? (
              <img
                src={member.image}
                alt={member.name}
                className="relative size-24 rounded-full object-cover object-top ring-2 ring-white/20"
              />
            ) : (
              <div className="relative flex size-24 items-center justify-center rounded-full bg-navy-900 text-2xl font-semibold text-white ring-2 ring-white/20">
                {member.initials}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Code2 className="size-3.5" />
            Technology leadership
          </span>

          <h3 className="mt-4 text-xl font-semibold tracking-tight md:text-2xl">
            {member.name}
          </h3>
          <p className="mt-1.5 text-xs font-medium text-white md:text-sm">{member.role}</p>
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
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                {member.focusLabel ?? 'Focus areas'}
              </p>
              <ul className="mt-3 space-y-2">
                {member.focusAreas.map((area) => (
                  <li
                    key={area}
                    className="flex items-start gap-2 text-xs leading-relaxed text-navy-100 md:text-sm"
                  >
                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
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
