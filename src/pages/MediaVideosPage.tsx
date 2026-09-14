import { Video } from 'lucide-react'

import { AnimateIn } from '@/components/landing/motion'
import { ButtonLink } from '@/components/landing/ButtonLink'
import { Badge } from '@/components/ui/badge'

export function MediaVideosPage() {
  return (
    <div className="bg-background">
      <section className="border-b border-border bg-background py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn className="mx-auto max-w-2xl text-center">
            <Badge
              variant="outline"
              className="mb-4 border-primary/20 bg-primary/5 text-primary"
            >
              TaxPhil Media
            </Badge>
            <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
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
          <AnimateIn className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Video className="size-7" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                No videos published yet
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Tutorials and walkthroughs are on the way. Sign up to get
                notified when new content goes live.
              </p>
            </div>
            <ButtonLink to="/signup" className="mt-2">
              Create a free account
            </ButtonLink>
          </AnimateIn>
        </div>
      </section>
    </div>
  )
}
