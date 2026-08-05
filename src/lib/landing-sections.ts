/** Section ids that exist on the landing page (`/`). */
export const LANDING_SECTION_IDS = [
  'online-services',
  'plans',
  'features',
  'how-it-works',
  'testimonials',
  'free-consultation',
] as const

export type LandingSectionId = (typeof LANDING_SECTION_IDS)[number]

/** Section ids that exist on the about page (`/about`). */
export const ABOUT_SECTION_IDS = [
  'mission',
  'values',
  'leadership',
  'expertise',
] as const

export type AboutSectionId = (typeof ABOUT_SECTION_IDS)[number]

const landingSectionSet = new Set<string>(LANDING_SECTION_IDS)
const aboutSectionSet = new Set<string>(ABOUT_SECTION_IDS)

export function isLandingSectionId(id: string): id is LandingSectionId {
  return landingSectionSet.has(id)
}

export function isAboutSectionId(id: string): id is AboutSectionId {
  return aboutSectionSet.has(id)
}

export function landingSectionPath(id: LandingSectionId): string {
  return `/#${id}`
}

export function aboutSectionPath(id: AboutSectionId): string {
  return `/about#${id}`
}

export const landingNavSections = [
  { id: 'online-services' as const, label: 'Online Services' },
  { id: 'plans' as const, label: 'Plans' },
  { id: 'features' as const, label: 'Features' },
  { id: 'how-it-works' as const, label: 'How it works' },
  { id: 'testimonials' as const, label: 'Testimonials' },
] as const
