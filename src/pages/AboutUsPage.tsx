import { AboutCta } from '@/components/about/AboutCta'
import { AboutExpertise } from '@/components/about/AboutExpertise'
import { AboutHero } from '@/components/about/AboutHero'
import { AboutLeadership } from '@/components/about/AboutLeadership'
import { AboutMission } from '@/components/about/AboutMission'
import { AboutSectionNav } from '@/components/about/AboutSectionNav'
import { AboutStats } from '@/components/about/AboutStats'
import { AboutValues } from '@/components/about/AboutValues'

export function AboutUsPage() {
  return (
    <div className="bg-background">
      <AboutHero />
      <AboutStats />
      <AboutSectionNav />
      <AboutMission />
      <AboutValues />
      <AboutLeadership />
      <AboutExpertise />
      <AboutCta />
    </div>
  )
}
