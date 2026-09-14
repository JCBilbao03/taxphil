import { MessageCircle, Video } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ButtonLink } from '@/components/landing/ButtonLink'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function VideoCallView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Video call with a tax expert</CardTitle>
        <CardDescription>
          Schedule a 1-on-1 session with a licensed TaxPhil advisor for
          personalized BIR filing guidance.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Video className="size-7" />
        </div>
        <div className="max-w-sm space-y-2">
          <p className="text-sm font-medium text-foreground">
            No experts available to call right now
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Video consultations open when an advisor is online. Message support
            to request a session or get help over chat in the meantime.
          </p>
        </div>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link to="/connect" className={cn(buttonVariants(), 'gap-2')}>
            <MessageCircle className="size-4" />
            Open support chat
          </Link>
          <ButtonLink variant="outline" to="/signup">
            Book a consultation
          </ButtonLink>
        </div>
      </CardContent>
    </Card>
  )
}
