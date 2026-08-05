import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ShieldCheck } from 'lucide-react'

import { certifications } from '@/components/about/about-data'
import { ButtonLink } from '@/components/landing/ButtonLink'
import { MotionOnMount, fadeUp } from '@/components/landing/motion'
import { aboutSectionPath } from '@/lib/landing-sections'
import { Badge } from '@/components/ui/badge'

const heroStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
}

export function AboutHero() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="relative overflow-hidden bg-navy-900 text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <motion.div
          className="absolute -top-40 left-1/4 size-[560px] rounded-full bg-navy-500/40 blur-3xl"
          animate={
            prefersReducedMotion
              ? undefined
              : { scale: [1, 1.1, 1], opacity: [0.35, 0.55, 0.35] }
          }
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-24 top-16 size-96 rounded-full bg-emerald-500/10 blur-3xl"
          animate={
            prefersReducedMotion ? undefined : { x: [0, -28, 0], y: [0, 18, 0] }
          }
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,#000_60%,transparent_110%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-32 md:pt-28 md:pb-40">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={prefersReducedMotion ? 'visible' : 'hidden'}
          animate="visible"
          variants={heroStagger}
        >
          <motion.div variants={fadeUp}>
            <Badge className="mb-6 border-none bg-white/10 text-white hover:bg-white/10">
              About TaxPhil
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl"
          >
            Built by finance experts.
            <span className="block bg-gradient-to-r from-white via-navy-100 to-navy-300 bg-clip-text text-transparent">
              Engineered for Filipino taxpayers.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-navy-100"
          >
            TaxPhil is an accredited online tax filing platform for freelancers,
            self-employed professionals, sole proprietors, and small businesses
            across the Philippines. We pair licensed expert support with software
            that handles the heavy lifting — so you can focus on your work, not on
            deciphering BIR forms.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <ButtonLink
              size="lg"
              variant="secondary"
              to="/signup"
              className="group h-12 bg-white px-8 text-base text-primary transition-transform hover:scale-[1.02] hover:bg-navy-50 active:scale-[0.98]"
            >
              Get a free consultation
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </ButtonLink>
            <ButtonLink
              size="lg"
              variant="outline"
              to={aboutSectionPath('leadership')}
              className="h-12 border-white/25 bg-transparent px-8 text-base text-white transition-transform hover:scale-[1.02] hover:bg-white/10 active:scale-[0.98]"
            >
              Meet our team
            </ButtonLink>
          </motion.div>
        </motion.div>

        <MotionOnMount
          delay={0.6}
          className="mt-14 flex flex-wrap items-center justify-center gap-3"
        >
          {certifications.map((cert) => (
            <span
              key={cert}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-navy-100"
            >
              <ShieldCheck className="size-3.5 text-emerald-400" />
              {cert}
            </span>
          ))}
        </MotionOnMount>
      </div>
    </section>
  )
}
