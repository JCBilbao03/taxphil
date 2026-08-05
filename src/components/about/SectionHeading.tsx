import { AnimateIn } from '@/components/landing/motion'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description?: string
  align?: 'center' | 'left'
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: SectionHeadingProps) {
  return (
    <AnimateIn
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow ? (
        <Badge
          variant="outline"
          className="mb-4 border-primary/20 bg-primary/5 text-primary"
        >
          {eyebrow}
        </Badge>
      ) : null}
      <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </AnimateIn>
  )
}
