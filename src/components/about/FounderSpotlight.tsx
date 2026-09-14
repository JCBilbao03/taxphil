import { ArrowRight, Check, Quote } from 'lucide-react'

import type { TeamMember } from '@/components/about/about-data'
import { ButtonLink } from '@/components/landing/ButtonLink'
import { AnimateIn } from '@/components/landing/motion'

interface FounderSpotlightProps {
  member: TeamMember
}

export function FounderSpotlight({ member }: FounderSpotlightProps) {
  return (
    <AnimateIn className="relative overflow-hidden rounded-xl border border-navy-800 bg-navy-900 text-white">
      <div className="relative grid gap-10 p-8 md:p-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            {member.image ? (
              <img
                src={member.image}
                alt={member.name}
                className="size-24 rounded-full object-cover ring-1 ring-white/20"
              />
            ) : (
              <div className="flex size-24 items-center justify-center rounded-full bg-navy-800 text-2xl font-medium text-white ring-1 ring-white/20">
                {member.initials}
              </div>
            )}

            <h3 className="mt-6 text-2xl font-medium tracking-tight">{member.name}</h3>

            {member.credentials?.length ? (
              <div className="mt-3 flex flex-wrap justify-center gap-2 lg:justify-start">
                {member.credentials.map((credential) => (
                  <span
                    key={credential}
                    className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-medium tracking-wide text-navy-100"
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
              <p className="text-xs font-medium uppercase tracking-wider text-navy-200">
                {member.focusLabel ?? 'Focus areas'}
              </p>
              <ul className="mt-4 space-y-2">
                {member.focusAreas.map((area) => (
                  <li
                    key={area}
                    className="flex items-start gap-2 text-sm leading-relaxed text-navy-100"
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-navy-200" />
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col lg:col-span-8">
          <div className="space-y-4">
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
            <blockquote className="mt-8 rounded-lg border border-white/10 bg-white/5 p-6">
              <Quote className="size-5 text-navy-200" aria-hidden="true" />
              <p className="mt-3 text-base leading-relaxed text-navy-100 italic">
                {member.quote}
              </p>
            </blockquote>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink
              variant="secondary"
              to="/connect"
              className="group h-11 bg-card px-6 text-primary transition-colors hover:bg-navy-50"
            >
              Book a free consultation
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </ButtonLink>
            <ButtonLink
              variant="outline"
              to="/#plans"
              className="h-11 border-white/25 bg-transparent px-6 text-white transition-colors hover:bg-white/10"
            >
              View advisory services
            </ButtonLink>
          </div>
        </div>
      </div>
    </AnimateIn>
  )
}
