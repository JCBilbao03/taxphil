import { motion, useReducedMotion } from 'framer-motion'

export function HeroBackground() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute -top-32 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-navy-200/40 blur-3xl"
        animate={
          prefersReducedMotion
            ? undefined
            : {
                scale: [1, 1.08, 1],
                opacity: [0.4, 0.55, 0.4],
              }
        }
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/4 -right-24 size-72 rounded-full bg-navy-300/25 blur-3xl"
        animate={
          prefersReducedMotion
            ? undefined
            : {
                x: [0, -20, 0],
                y: [0, 16, 0],
                scale: [1, 1.05, 1],
              }
        }
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-16 -left-16 size-64 rounded-full bg-navy-100/50 blur-3xl"
        animate={
          prefersReducedMotion
            ? undefined
            : {
                x: [0, 24, 0],
                y: [0, -12, 0],
              }
        }
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0a254008_1px,transparent_1px),linear-gradient(to_bottom,#0a254008_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
    </div>
  )
}
