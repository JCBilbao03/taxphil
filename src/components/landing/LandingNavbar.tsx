import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

import { ButtonLink } from '@/components/landing/ButtonLink'
import { NavMediaDropdown } from '@/components/landing/NavMediaDropdown'
import { landingNavSections, landingSectionPath } from '@/lib/landing-sections'
import { cn } from '@/lib/utils'

const routeNavLinks = [{ to: '/about', label: 'About us' }] as const

const navLinkCount = routeNavLinks.length + landingNavSections.length

const EASE = [0.21, 0.47, 0.32, 0.98] as [number, number, number, number]

export function LandingNavbar() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.header
      initial={prefersReducedMotion ? false : { y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="sticky top-0 z-50 border-b border-border/60 bg-white/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="group flex items-center gap-2.5">
          <motion.div
            whileHover={{ scale: 1.05, rotate: -3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className="flex size-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground"
          >
            TP
          </motion.div>
          <span className="text-lg font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
            TaxPhil
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {routeNavLinks.map(({ to, label }, index) => (
            <motion.div
              key={to}
              initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.06, duration: 0.4, ease: EASE }}
            >
              <Link
                to={to}
                className="nav-link-animated text-sm font-medium text-muted-foreground"
              >
                {label}
              </Link>
            </motion.div>
          ))}
          {landingNavSections.map(({ id, label }, index) => (
            <motion.div
              key={id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.1 + (routeNavLinks.length + index) * 0.06,
                duration: 0.4,
                ease: EASE,
              }}
            >
              <Link
                to={landingSectionPath(id)}
                className="nav-link-animated text-sm font-medium text-muted-foreground"
              >
                {label}
              </Link>
            </motion.div>
          ))}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + navLinkCount * 0.06, duration: 0.4, ease: EASE }}
          >
            <NavMediaDropdown />
          </motion.div>
        </nav>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35, duration: 0.45 }}
          className="flex items-center gap-3"
        >
          <ButtonLink
            variant="ghost"
            size="sm"
            to="/login"
            className="hidden sm:inline-flex"
          >
            Log in
          </ButtonLink>
          <ButtonLink
            size="sm"
            to="/signup"
            className="transition-transform hover:scale-105 active:scale-95"
          >
            Try it free
          </ButtonLink>
        </motion.div>
      </div>
    </motion.header>
  )
}

interface LandingFooterProps {
  className?: string
}

export function LandingFooter({ className }: LandingFooterProps) {
  return (
    <footer className={cn('border-t border-border bg-white', className)}>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                TP
              </div>
              <span className="text-lg font-semibold">TaxPhil</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The premier online tax filing tool for freelancers, professionals,
              sole proprietors, and micro &amp; small businesses in the
              Philippines.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Product</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {landingNavSections.map(({ id, label }) => (
                <li key={id}>
                  <Link
                    to={landingSectionPath(id)}
                    className="transition-colors hover:text-foreground"
                  >
                    {id === 'plans' ? 'Plans & Pricing' : label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Company</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to="/about" className="transition-colors hover:text-foreground">
                  About us
                </Link>
              </li>
              <li>
                <Link
                  to={landingSectionPath('free-consultation')}
                  className="transition-colors hover:text-foreground"
                >
                  Free consultation
                </Link>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-foreground">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">TaxPhil Media</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="/media/videos" className="transition-colors hover:text-foreground">
                  Video Content
                </a>
              </li>
              <li>
                <a href="/media/blog" className="transition-colors hover:text-foreground">
                  Blog
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">Legal</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="transition-colors hover:text-foreground">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors hover:text-foreground">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} TaxPhil. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
