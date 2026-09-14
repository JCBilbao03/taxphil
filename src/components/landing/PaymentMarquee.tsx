import { motion, useReducedMotion } from 'framer-motion'

import { cn } from '@/lib/utils'

interface MarqueeProps {
  items: readonly string[]
  className?: string
}

export function PaymentMarquee({ items, className }: MarqueeProps) {
  const prefersReducedMotion = useReducedMotion()
  const doubled = [...items, ...items]

  if (prefersReducedMotion) {
    return (
      <div className={cn('flex flex-wrap items-center justify-center gap-4', className)}>
        {items.map((channel) => (
          <ChannelChip key={channel} label={channel} />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />

      <motion.div
        className="flex w-max gap-4"
        animate={{ x: ['0%', '-50%'] }}
        transition={{
          x: { duration: 28, repeat: Infinity, ease: 'linear' },
        }}
      >
        {doubled.map((channel, index) => (
          <ChannelChip key={`${channel}-${index}`} label={channel} />
        ))}
      </motion.div>
    </div>
  )
}

function ChannelChip({ label }: { label: string }) {
  return (
    <div className="flex h-14 min-w-[120px] shrink-0 items-center justify-center rounded-lg border border-border bg-card px-6 text-sm font-medium text-muted-foreground">
      {label}
    </div>
  )
}
