import { Play } from 'lucide-react'

import { AnimateIn, HoverLift, StaggerGroup, StaggerItem } from '@/components/landing/motion'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const videos = [
  {
    id: 'bir-basics',
    title: 'BIR Tax Filing Basics for Freelancers',
    description:
      'A quick walkthrough of quarterly ITR filing, percentage tax, and what records to keep as a self-employed professional.',
    duration: '12 min',
    category: 'Getting started',
  },
  {
    id: '1701q-guide',
    title: 'How to File 1701Q with TaxPhil',
    description:
      'Step-by-step demo of logging income, reviewing auto-generated forms, and submitting your quarterly income tax return.',
    duration: '8 min',
    category: 'Product tutorial',
  },
  {
    id: '8-percent-tax',
    title: '8% vs OSD: Which Tax Option Fits You?',
    description:
      'Compare the 8% flat tax rate and Optional Standard Deduction so you can choose the right scheme for your business.',
    duration: '15 min',
    category: 'Tax planning',
  },
  {
    id: 'deadline-reminders',
    title: 'Never Miss a BIR Deadline Again',
    description:
      'Learn how TaxPhil tracks filing due dates, sends reminders, and helps you pay on time through multiple channels.',
    duration: '6 min',
    category: 'Product tutorial',
  },
  {
    id: 'business-registration',
    title: 'Registering Your Business in the Philippines',
    description:
      'DTI, SEC, and LGU registration explained — what you need, how long it takes, and when to engage an accountant.',
    duration: '18 min',
    category: 'Business setup',
  },
  {
    id: 'withholding-tax',
    title: 'Withholding Tax Explained for Small Businesses',
    description:
      'Understand 0619-E, 1601-C, and expanded withholding rules so you stay compliant when paying suppliers and staff.',
    duration: '14 min',
    category: 'Compliance',
  },
] as const

export function MediaVideosPage() {
  return (
    <div className="bg-white">
      <section className="border-b border-border bg-gradient-to-b from-navy-50/80 to-white py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn className="mx-auto max-w-2xl text-center">
            <Badge
              variant="outline"
              className="mb-4 border-primary/20 bg-primary/5 text-primary"
            >
              TaxPhil Media
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Video Content
            </h1>
            <p className="mt-4 text-muted-foreground">
              Watch guides, tutorials, and tax tips from the TaxPhil team — built
              for freelancers, professionals, and small business owners in the
              Philippines.
            </p>
          </AnimateIn>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <StaggerGroup className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <StaggerItem key={video.id}>
                <HoverLift lift={4}>
                  <Card className="group h-full overflow-hidden shadow-sm">
                    <div className="relative flex aspect-video items-center justify-center bg-primary/10">
                      <div className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-105">
                        <Play className="ml-0.5 size-6" />
                      </div>
                      <Badge
                        variant="outline"
                        className="absolute top-3 right-3 bg-white/90 text-xs"
                      >
                        {video.duration}
                      </Badge>
                    </div>
                    <CardHeader>
                      <Badge variant="outline" className="mb-2 w-fit text-xs">
                        {video.category}
                      </Badge>
                      <CardTitle className="text-base leading-snug">
                        {video.title}
                      </CardTitle>
                      <CardDescription className="leading-relaxed">
                        {video.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Coming soon — new videos added regularly.
                      </p>
                    </CardContent>
                  </Card>
                </HoverLift>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>
    </div>
  )
}
