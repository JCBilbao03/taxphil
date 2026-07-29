import { ArrowRight, CalendarDays } from 'lucide-react'

import { AnimateIn, HoverLift, StaggerGroup, StaggerItem } from '@/components/landing/motion'
import { ButtonLink } from '@/components/landing/ButtonLink'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const blogPosts = [
  {
    id: 'freelancer-tax-checklist',
    title: "The Freelancer's Quarterly Tax Checklist",
    excerpt:
      "Everything you need to prepare before filing 1701Q and 2551Q — from ORs and invoices to allowable deductions.",
    category: 'Self-employed',
    date: 'Mar 12, 2026',
    readTime: '6 min read',
  },
  {
    id: 'bir-deadlines-2026',
    title: "2026 BIR Filing Deadlines You Can't Miss",
    excerpt:
      'A month-by-month calendar of quarterly and annual tax due dates for individuals and small businesses.',
    category: 'Compliance',
    date: 'Feb 28, 2026',
    readTime: '8 min read',
  },
  {
    id: 'register-sole-prop',
    title: 'How to Register as a Sole Proprietor in the Philippines',
    excerpt:
      "DTI business name registration, BIR Form 1901, and mayor's permit — the complete startup compliance guide.",
    category: 'Business setup',
    date: 'Feb 14, 2026',
    readTime: '10 min read',
  },
  {
    id: 'percentage-vs-vat',
    title: 'Percentage Tax vs VAT: When to Switch',
    excerpt:
      'Understand the ₱3M gross sales threshold and what changes when your business becomes VAT-registered.',
    category: 'Tax planning',
    date: 'Jan 30, 2026',
    readTime: '7 min read',
  },
  {
    id: 'bookkeeping-basics',
    title: 'Bookkeeping Basics for Micro Businesses',
    excerpt:
      "Simple record-keeping habits that make tax season painless — even if you don't have a full-time accountant yet.",
    category: 'Accounting',
    date: 'Jan 18, 2026',
    readTime: '5 min read',
  },
  {
    id: 'tax-consultation-guide',
    title: 'When to Book a Tax Consultation',
    excerpt:
      'Signs you need expert advice — mixed income, back filings, audit letters, or choosing between 8% and itemized deductions.',
    category: 'Advisory',
    date: 'Jan 5, 2026',
    readTime: '4 min read',
  },
] as const

export function MediaBlogPage() {
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
          <StaggerGroup className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {blogPosts.map((post) => (
              <StaggerItem key={post.id}>
                <HoverLift lift={4}>
                  <Card className="flex h-full flex-col shadow-sm">
                    <CardHeader className="flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {post.category}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="size-3" />
                          {post.date}
                        </span>
                      </div>
                      <CardTitle className="text-base leading-snug">
                        {post.title}
                      </CardTitle>
                      <CardDescription className="leading-relaxed">
                        {post.excerpt}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{post.readTime}</span>
                        <span>Coming soon</span>
                      </div>
                    </CardContent>
                  </Card>
                </HoverLift>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <AnimateIn delay={0.15} className="mt-14 text-center">
            <p className="text-sm text-muted-foreground">
              New articles published regularly. Have a topic you&apos;d like us to cover?
            </p>
            <ButtonLink to="/signup" className="mt-4 gap-2">
              Get started with TaxPhil
              <ArrowRight className="size-4" />
            </ButtonLink>
          </AnimateIn>
        </div>
      </section>
    </div>
  )
}
