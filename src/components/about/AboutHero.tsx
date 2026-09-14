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
      <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-32 md:pt-28 md:pb-40">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={prefersReducedMotion ? 'visible' : 'hidden'}
          animate="visible"
          variants={heroStagger}
        >
          <motion.div variants={fadeUp}>
            <Badge className="mb-6 border-white/15 bg-white/10 text-white hover:bg-white/10">
              About TaxPhil
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-4xl font-medium tracking-tight text-white md:text-5xl lg:text-6xl"
          >
            Built by finance experts.
            <span className="mt-2 block text-navy-200">
              Engineered for Filipino taxpayers.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-navy-200"
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
              to="/connect"
              className="group h-12 bg-card px-8 text-base text-primary transition-colors hover:bg-navy-50"
            >
              Get a free consultation
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </ButtonLink>
            <ButtonLink
              size="lg"
              variant="outline"
              to={aboutSectionPath('leadership')}
              className="h-12 border-white/25 bg-transparent px-8 text-base text-white transition-colors hover:bg-white/10"
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
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-navy-100"
            >
              <ShieldCheck className="size-3.5 text-navy-200" />
              {cert}
            </span>
          ))}
        </MotionOnMount>
      </div>
    </section>
  )
}
