import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, Users, Video, VideoOff } from 'lucide-react'

import { CallControls } from '@/components/connect/CallControls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useConnectStore } from '@/store/useConnectStore'
import { cn } from '@/lib/utils'

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function VideoConferenceView() {
  const conferenceStatus = useConnectStore((state) => state.conferenceStatus)
  const setConferenceStatus = useConnectStore((state) => state.setConferenceStatus)
  const isMuted = useConnectStore((state) => state.isMuted)
  const isCameraOff = useConnectStore((state) => state.isCameraOff)
  const isScreenSharing = useConnectStore((state) => state.isScreenSharing)
  const toggleMute = useConnectStore((state) => state.toggleMute)
  const toggleCamera = useConnectStore((state) => state.toggleCamera)
  const toggleScreenShare = useConnectStore((state) => state.toggleScreenShare)

  const [duration, setDuration] = useState(0)
  const [displayName, setDisplayName] = useState('')

  const selfLabel = displayName.trim() || 'You'
  const selfAvatar = useMemo(
    () => (displayName.trim() ? getInitials(displayName) : 'YO'),
    [displayName],
  )

  useEffect(() => {
    if (conferenceStatus !== 'active') return
    const interval = setInterval(() => setDuration((d) => d + 1), 1000)
    return () => clearInterval(interval)
  }, [conferenceStatus])

  const joinConference = useCallback(() => {
    if (!displayName.trim()) return
    setDuration(0)
    setConferenceStatus('connecting')
    setTimeout(() => setConferenceStatus('active'), 2000)
  }, [displayName, setConferenceStatus])

  const leaveConference = useCallback(() => {
    setConferenceStatus('idle')
  }, [setConferenceStatus])

  if (conferenceStatus === 'idle') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Join video conference</CardTitle>
          <CardDescription>
            Group tax consultations with multiple participants — for quarterly
            reviews, corporate filings, or team sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
            <p className="text-sm font-medium text-foreground">
              No scheduled conferences
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              When your advisor schedules a group session, the meeting details
              will appear here. Contact support to arrange a conference.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="displayName" className="text-sm font-medium">
              Display name
            </label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you appear in the conference"
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="flex-1 gap-2"
              disabled={!displayName.trim()}
              onClick={joinConference}
            >
              <Video className="size-4" />
              Join with video
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              disabled={!displayName.trim()}
              onClick={joinConference}
            >
              Join with audio only
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-navy-900">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div>
          <p className="text-sm font-medium text-white">Video conference</p>
          <p className="text-xs text-navy-300">{selfLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-navy-200">
            <Users className="size-3.5" />1 participant
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-navy-800 px-2.5 py-1 text-xs text-white">
            <Clock className="size-3" />
            {conferenceStatus === 'connecting'
              ? 'Connecting...'
              : formatDuration(duration)}
          </span>
          {conferenceStatus === 'active' ? (
            <Badge className="bg-deadline-urgent/90 text-white">LIVE</Badge>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-[360px] flex-1 grid-cols-1 gap-2 p-3">
        {conferenceStatus === 'connecting' ? (
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto size-12 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="mt-4 text-sm text-navy-200">Joining conference...</p>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'relative flex flex-col items-center justify-center rounded-xl bg-navy-800 p-4 ring-2 ring-primary/50',
            )}
          >
            {isCameraOff ? (
              <div className="flex size-16 items-center justify-center rounded-full bg-navy-700 text-lg font-medium text-white">
                {selfAvatar}
              </div>
            ) : (
              <div className="flex min-h-[200px] w-full items-center justify-center rounded-lg bg-navy-700/80 text-sm text-navy-200">
                Your camera
              </div>
            )}

            <div className="absolute bottom-3 left-3">
              <span className="rounded-md bg-navy-900/80 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
                {selfLabel} (You)
              </span>
            </div>

            {isCameraOff ? (
              <div className="absolute bottom-3 right-3 rounded-full bg-navy-600 p-1">
                <VideoOff className="size-3 text-white" />
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex justify-center border-t border-white/10 p-4">
        <CallControls
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isScreenSharing={isScreenSharing}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onToggleScreenShare={toggleScreenShare}
          onEndCall={leaveConference}
        />
      </div>
    </div>
  )
}
