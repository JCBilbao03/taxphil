import { ArrowRight } from 'lucide-react'

import { ButtonLink } from '@/components/landing/ButtonLink'
import { MotionOnMount } from '@/components/landing/motion'

export function AboutCta() {
  return (
    <section className="relative overflow-hidden border-t border-border bg-navy-900 py-20 text-white md:py-24">
      <MotionOnMount className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-medium tracking-tight md:text-4xl">
          Ready to simplify your taxes?
        </h2>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-navy-200">
          Create a free account and book a complimentary consultation with our
          licensed experts — no credit card, no commitment.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <ButtonLink
            size="lg"
            variant="secondary"
            to="/signup"
            className="group h-12 bg-card px-8 text-base text-primary transition-colors hover:bg-navy-50"
          >
            Get started for free
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </ButtonLink>
          <ButtonLink
            size="lg"
            variant="outline"
            to="/"
            className="h-12 border-white/30 bg-transparent px-8 text-base text-white transition-colors hover:bg-white/10 hover:text-white"
          >
            Explore TaxPhil
          </ButtonLink>
        </div>
      </MotionOnMount>
    </section>
  )
}
