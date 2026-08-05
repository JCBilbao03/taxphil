import { useEffect, useState } from 'react'

/**
 * Tracks which of the given section ids is currently closest to the top of the
 * viewport. `offset` accounts for sticky headers overlapping the section start.
 */
export function useActiveSection(sectionIds: string[], offset = 180): string | null {
  const [activeId, setActiveId] = useState<string | null>(sectionIds[0] ?? null)

  useEffect(() => {
    const resolveActiveSection = () => {
      let current = sectionIds[0] ?? null

      for (const id of sectionIds) {
        const element = document.getElementById(id)
        if (!element) continue

        if (element.getBoundingClientRect().top - offset <= 0) {
          current = id
        }
      }

      setActiveId(current)
    }

    resolveActiveSection()
    window.addEventListener('scroll', resolveActiveSection, { passive: true })
    window.addEventListener('resize', resolveActiveSection)

    return () => {
      window.removeEventListener('scroll', resolveActiveSection)
      window.removeEventListener('resize', resolveActiveSection)
    }
  }, [offset, sectionIds])

  return activeId
}
