/** Sticky header height — keep in sync with `scroll-mt-*` on anchored sections. */
const HEADER_OFFSET_PX = 80
const MAX_ATTEMPTS = 20
const RETRY_MS = 50

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Scrolls to a document element by id, retrying briefly while route content mounts.
 * Returns true once the element was found and scrolled to.
 */
export function scrollToHashId(id: string, attempt = 0): boolean {
  const element = document.getElementById(id)
  if (!element) {
    if (attempt < MAX_ATTEMPTS) {
      window.setTimeout(() => scrollToHashId(id, attempt + 1), RETRY_MS)
    }
    return false
  }

  const top =
    element.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET_PX

  window.scrollTo({
    top: Math.max(top, 0),
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })

  return true
}

export function hashToId(hash: string): string {
  return hash.startsWith('#') ? hash.slice(1) : hash
}
