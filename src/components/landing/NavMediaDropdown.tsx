import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

const mediaLinks = [
  { to: '/media/videos', label: 'Video Content' },
  { to: '/media/blog', label: 'Blog' },
] as const

export function NavMediaDropdown() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        close()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [close, open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'nav-link-animated inline-flex items-center gap-1 text-sm font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          open && 'text-foreground',
        )}
      >
        TaxPhil Media
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div className="absolute top-full left-1/2 z-50 mt-2 min-w-44 -translate-x-1/2 rounded-lg border border-border bg-card py-1 shadow-md">
          {mediaLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={close}
              className="block px-4 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:bg-muted"
            >
              {label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
