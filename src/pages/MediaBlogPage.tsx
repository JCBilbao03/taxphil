import { FileText } from 'lucide-react'

import { AnimateIn } from '@/components/landing/motion'
import { ButtonLink } from '@/components/landing/ButtonLink'
import { Badge } from '@/components/ui/badge'

export function MediaBlogPage() {
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
              Blog
            </h1>
            <p className="mt-4 text-muted-foreground">
              Written guides, compliance tips, and business advice from TaxPhil —
              practical content for Philippine taxpayers.
            </p>
          </AnimateIn>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateIn className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-7" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                No articles published yet
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                We&apos;re preparing guides on BIR compliance, filing, and
                business setup. Check back soon.
              </p>
            </div>
            <ButtonLink to="/signup" className="mt-2">
              Get started with TaxPhil
            </ButtonLink>
          </AnimateIn>
        </div>
      </section>
    </div>
  )
}
