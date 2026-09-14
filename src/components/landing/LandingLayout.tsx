import { useCallback, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'

import { ButtonLink } from '@/components/landing/ButtonLink'
import { LandingFooter, LandingNavbar } from '@/components/landing/LandingNavbar'
import { LandingPage } from '@/pages/LandingPage'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function LandingLayout() {
  const [showBanner, setShowBanner] = useState(true)
  const prefersReducedMotion = useReducedMotion()

  const dismissBanner = useCallback(() => {
    setShowBanner(false)
  }, [])

  return (
    <div className="flex min-h-svh flex-col">
      <LandingNavbar />
      <main className={cn('flex-1', showBanner && 'pb-24')}>
        <LandingPage />
      </main>
      <LandingFooter />

      <AnimatePresence>
        {showBanner ? (
          <motion.div
            key="cta-banner"
            initial={prefersReducedMotion ? false : { y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              delay: prefersReducedMotion ? 0 : 1.2,
            }}
            className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-4 backdrop-blur-sm"
          >
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4, duration: 0.4 }}
                className="flex-1 text-center sm:text-left"
              >
                <p className="text-sm font-medium text-foreground">
                  Struggling with tax compliance?
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Join thousands of users in the Philippines. File in minutes, get
                  expert guidance, and pay in flexible installments.
                </p>
              </motion.div>
              <div className="flex shrink-0 items-center gap-2">
                <ButtonLink size="sm" to="/dashboard">
                  Try it for free
                </ButtonLink>
                <Button size="sm" variant="ghost" onClick={dismissBanner}>
                  Maybe later
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Dismiss banner"
                  onClick={dismissBanner}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
