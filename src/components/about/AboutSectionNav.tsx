import { Link } from 'react-router-dom'

import { aboutSections } from '@/components/about/about-data'
import { aboutSectionPath, type AboutSectionId } from '@/lib/landing-sections'
import { useActiveSection } from '@/hooks/useActiveSection'
import { cn } from '@/lib/utils'

const aboutSectionIds = aboutSections.map((section) => section.id)

export function AboutSectionNav() {
  const activeId = useActiveSection(aboutSectionIds)

  return (
    <div className="sticky top-16 z-40 border-y border-border bg-card/90 backdrop-blur-sm">
      <nav
        aria-label="About page sections"
        className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-6 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {aboutSections.map(({ id, label }) => (
          <Link
            key={id}
            to={aboutSectionPath(id as AboutSectionId)}
            aria-current={activeId === id ? 'true' : undefined}
            className={cn(
              'shrink-0 rounded-md px-4 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              activeId === id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
