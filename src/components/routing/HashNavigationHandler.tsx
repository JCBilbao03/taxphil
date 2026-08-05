import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  aboutSectionPath,
  isAboutSectionId,
  isLandingSectionId,
  landingSectionPath,
} from '@/lib/landing-sections'
import { hashToId, scrollToHashId } from '@/lib/scroll-to-hash'

/**
 * Keeps hash navigation working across routes in the SPA:
 * - Redirects landing hashes off the home page (e.g. `/about#plans` → `/#plans`)
 * - Redirects about hashes off the about page (e.g. `/#mission` → `/about#mission`)
 * - Scrolls to the target section after the destination page mounts
 */
export function HashNavigationHandler() {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!hash) return

    const id = hashToId(hash)

    if (isLandingSectionId(id) && pathname !== '/') {
      navigate(landingSectionPath(id), { replace: true })
      return
    }

    if (isAboutSectionId(id) && pathname !== '/about') {
      navigate(aboutSectionPath(id), { replace: true })
      return
    }

    scrollToHashId(id)
  }, [hash, navigate, pathname])

  return null
}
