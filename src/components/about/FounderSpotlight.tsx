import { ArrowRight, Check, Quote } from 'lucide-react'

import type { TeamMember } from '@/components/about/about-data'
import { ButtonLink } from '@/components/landing/ButtonLink'
import { AnimateIn } from '@/components/landing/motion'

interface FounderSpotlightProps {
  member: TeamMember
}

export function FounderSpotlight({ member }: FounderSpotlightProps) {
  return (
    <AnimateIn className="relative overflow-hidden rounded-3xl bg-navy-900 text-white shadow-2xl shadow-navy-900/20">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-24 -right-20 size-80 rounded-full bg-navy-500/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 size-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_70%_60%_at_30%_0%,#000_50%,transparent_100%)]" />
      </div>

      <div className="relative grid gap-10 p-8 md:p-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="relative">
              <div
                className="absolute -inset-1 rounded-full bg-gradient-to-tr from-emerald-400/60 to-navy-200/60 blur-md"
                aria-hidden="true"
              />
              <div className="relative flex size-24 items-center justify-center rounded-full bg-navy-800 text-2xl font-semibold text-white ring-2 ring-white/20">
                {member.initials}
              </div>
            </div>

            <h3 className="mt-6 text-2xl font-semibold tracking-tight">{member.name}</h3>

            {member.credentials?.length ? (
              <div className="mt-3 flex flex-wrap justify-center gap-2 lg:justify-start">
                {member.credentials.map((credential) => (
                  <span
                    key={credential}
                    className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-emerald-300"
                  >
                    {credential}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="mt-4 text-sm font-medium text-white">{member.role}</p>
            {member.roleDetail ? (
              <p className="text-sm text-navy-200">{member.roleDetail}</p>
            ) : null}
          </div>

          {member.focusAreas?.length ? (
            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                {member.focusLabel ?? 'Focus areas'}
              </p>
              <ul className="mt-4 space-y-2.5">
                {member.focusAreas.map((area) => (
                  <li
                    key={area}
                    className="flex items-start gap-2.5 text-sm leading-relaxed text-navy-100"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col lg:col-span-8">
          <div className="space-y-5">
            {member.bio.map((paragraph, index) => (
              <p
                key={paragraph.slice(0, 32)}
                className={
                  index === 0
                    ? 'text-lg leading-relaxed text-white'
                    : 'leading-relaxed text-navy-100'
                }
              >
                {paragraph}
              </p>
            ))}
          </div>

          {member.quote ? (
            <blockquote className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <Quote className="size-5 text-emerald-400" aria-hidden="true" />
              <p className="mt-3 text-base leading-relaxed text-navy-100 italic">
                {member.quote}
              </p>
            </blockquote>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink
              variant="secondary"
              to="/signup"
              className="group h-11 bg-white px-6 text-primary hover:bg-navy-50"
            >
              Book a free consultation
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </ButtonLink>
            <ButtonLink
              variant="outline"
              to="/#plans"
              className="h-11 border-white/25 bg-transparent px-6 text-white hover:bg-white/10"
            >
              View advisory services
            </ButtonLink>
          </div>
        </div>
      </div>
    </AnimateIn>
  )
}
