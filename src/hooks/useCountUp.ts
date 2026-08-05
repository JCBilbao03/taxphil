import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'

interface UseCountUpOptions {
  /** Animation length in milliseconds. */
  duration?: number
}

/**
 * Animates a number from zero to `target` the first time the returned ref
 * scrolls into view. Falls back to the final value when the user prefers
 * reduced motion.
 */
export function useCountUp(target: number, { duration = 1600 }: UseCountUpOptions = {}) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const prefersReducedMotion = useReducedMotion()
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!isInView) return

    if (prefersReducedMotion) {
      setValue(target)
      return
    }

    let frameId = 0
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = progress === 1 ? 1 : 1 - 2 ** (-10 * progress)

      setValue(Math.round(target * eased))

      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameId)
  }, [duration, isInView, prefersReducedMotion, target])

  return { ref, value }
}
