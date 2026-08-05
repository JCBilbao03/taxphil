import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

import { ButtonLink } from '@/components/landing/ButtonLink'
import { MotionOnMount } from '@/components/landing/motion'

export function AboutCta() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="relative overflow-hidden border-t border-border bg-primary py-20 text-primary-foreground md:py-24">
      <motion.div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        animate={
          prefersReducedMotion
            ? undefined
            : {
                background: [
                  'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.08) 0%, transparent 50%)',
                  'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.08) 0%, transparent 50%)',
                  'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.08) 0%, transparent 50%)',
                ],
              }
        }
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <MotionOnMount className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Ready to simplify your taxes?
        </h2>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-primary-foreground/80">
          Create a free account and book a complimentary consultation with our
          licensed experts — no credit card, no commitment.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <ButtonLink
            size="lg"
            variant="secondary"
            to="/signup"
            className="group h-12 bg-white px-8 text-base text-primary transition-transform hover:scale-105 hover:bg-navy-50 active:scale-95"
          >
            Get started for free
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </ButtonLink>
          <ButtonLink
            size="lg"
            variant="outline"
            to="/"
            className="h-12 border-primary-foreground/30 bg-transparent px-8 text-base text-primary-foreground transition-transform hover:scale-105 hover:bg-primary-foreground/10 hover:text-primary-foreground active:scale-95"
          >
            Explore TaxPhil
          </ButtonLink>
        </div>
      </MotionOnMount>
    </section>
  )
}
