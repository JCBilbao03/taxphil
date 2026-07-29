import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from 'framer-motion'

import { cn } from '@/lib/utils'

const EASE = [0.21, 0.47, 0.32, 0.98] as [number, number, number, number]

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1 },
}

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 48 },
  visible: { opacity: 1, y: 0 },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
}

export const staggerContainerFast: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
}

interface AnimateInProps extends HTMLMotionProps<'div'> {
  delay?: number
  duration?: number
  variant?: 'fadeUp' | 'fadeIn' | 'scaleIn' | 'slideUp'
  once?: boolean
}

export function AnimateIn({
  children,
  className,
  delay = 0,
  duration = 0.65,
  variant = 'fadeUp',
  once = true,
  ...props
}: AnimateInProps) {
  const prefersReducedMotion = useReducedMotion()
  const variants = { fadeUp, fadeIn, scaleIn, slideUp }[variant]

  return (
    <motion.div
      initial={prefersReducedMotion ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once, margin: '-60px' }}
      variants={variants}
      transition={{ duration, delay, ease: EASE }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

interface MotionOnMountProps extends HTMLMotionProps<'div'> {
  delay?: number
  duration?: number
  variant?: 'fadeUp' | 'fadeIn' | 'scaleIn' | 'slideUp'
}

export function MotionOnMount({
  children,
  className,
  delay = 0,
  duration = 0.65,
  variant = 'fadeUp',
  ...props
}: MotionOnMountProps) {
  const prefersReducedMotion = useReducedMotion()
  const variants = { fadeUp, fadeIn, scaleIn, slideUp }[variant]

  return (
    <motion.div
      initial={prefersReducedMotion ? 'visible' : 'hidden'}
      animate="visible"
      variants={variants}
      transition={{ duration, delay, ease: EASE }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

interface StaggerGroupProps extends HTMLMotionProps<'div'> {
  fast?: boolean
  once?: boolean
}

export function StaggerGroup({
  children,
  className,
  fast = false,
  once = true,
  ...props
}: StaggerGroupProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      initial={prefersReducedMotion ? 'visible' : 'hidden'}
      whileInView="visible"
      viewport={{ once, margin: '-50px' }}
      variants={fast ? staggerContainerFast : staggerContainer}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  ...props
}: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={fadeUp} transition={{ duration: 0.55, ease: EASE }} className={className} {...props}>
      {children}
    </motion.div>
  )
}

interface HoverLiftProps extends HTMLMotionProps<'div'> {
  lift?: number
}

export function HoverLift({
  children,
  className,
  lift = 6,
  ...props
}: HoverLiftProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      whileHover={
        prefersReducedMotion
          ? undefined
          : { y: -lift, transition: { duration: 0.25, ease: EASE } }
      }
      className={cn('transition-shadow duration-300 hover:shadow-lg', className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function MotionSection({
  children,
  className,
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.8, ease: EASE }}
      className={className}
    >
      {children}
    </motion.section>
  )
}
