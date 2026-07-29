import { useCallback, useEffect, useState } from 'react'
import {
  Clock,
  Copy,
  MicOff,
  Users,
  Video,
  VideoOff,
} from 'lucide-react'

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

const participants = [
  { id: 'p1', name: 'Maria Santos', role: 'Host · Tax Expert', avatar: 'MS', isMuted: false, isCameraOff: false },
  { id: 'p2', name: 'You', role: 'Taxpayer', avatar: 'JD', isMuted: false, isCameraOff: false, isSelf: true },
  { id: 'p3', name: 'Carlo Mendoza', role: 'Tax Expert', avatar: 'CM', isMuted: true, isCameraOff: false },
  { id: 'p4', name: 'Ana Reyes', role: 'Compliance Advisor', avatar: 'AR', isMuted: false, isCameraOff: true },
] as const

const MEETING_ID = 'TPH-2026-Q2-REVIEW'

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
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
  const [displayName, setDisplayName] = useState('Juan Dela Cruz')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (conferenceStatus !== 'active') return
    const interval = setInterval(() => setDuration((d) => d + 1), 1000)
    return () => clearInterval(interval)
  }, [conferenceStatus])

  const joinConference = useCallback(() => {
    setDuration(0)
    setConferenceStatus('connecting')
    setTimeout(() => setConferenceStatus('active'), 2000)
  }, [setConferenceStatus])

  const leaveConference = useCallback(() => {
    setConferenceStatus('idle')
  }, [setConferenceStatus])

  const copyMeetingId = useCallback(() => {
    void navigator.clipboard.writeText(MEETING_ID)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  if (conferenceStatus === 'idle') {
    return (
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle>Join video conference</CardTitle>
            <CardDescription>
              Group tax consultation with multiple experts — ideal for quarterly
              reviews, corporate filings, or live demo sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-5">
              <p className="text-sm font-semibold text-foreground">
                Q2 2026 Tax Review Session
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Hosted by Maria Santos · 4 participants expected
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">1701Q Review</Badge>
                <Badge variant="outline">2551Q Filing</Badge>
                <Badge variant="outline">Q&amp;A</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-medium">
                Display name
              </label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="flex-1 gap-2" onClick={joinConference}>
                <Video className="size-4" />
                Join with video
              </Button>
              <Button size="lg" variant="outline" className="flex-1" onClick={joinConference}>
                Join with audio only
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Meeting details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Meeting ID
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-medium">
                  {MEETING_ID}
                </code>
                <Button variant="outline" size="icon-sm" onClick={copyMeetingId}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
              {copied ? (
                <p className="mt-1 text-xs text-deadline-safe">Copied!</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Scheduled
              </p>
              <p className="mt-1 text-sm">Jul 20, 2026 · 2:00 PM (PHT)</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Participants
              </p>
              <ul className="mt-2 space-y-2">
                {participants.slice(0, 3).map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                      {p.avatar}
                    </div>
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-navy-900 shadow-lg">
      {/* Conference header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div>
          <p className="text-sm font-semibold text-white">
            Q2 2026 Tax Review Session
          </p>
          <p className="text-xs text-navy-300">{MEETING_ID}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-navy-200">
            <Users className="size-3.5" />
            {participants.length} participants
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-xs text-white">
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

      {/* Participant grid */}
      <div className="grid flex-1 grid-cols-2 gap-2 p-3 md:grid-cols-2 lg:grid-cols-4 min-h-[360px]">
        {conferenceStatus === 'connecting' ? (
          <div className="col-span-full flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto size-12 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              <p className="mt-4 text-sm text-navy-200">Joining conference...</p>
            </div>
          </div>
        ) : (
          participants.map((p) => {
            const camOff = 'isSelf' in p && p.isSelf ? isCameraOff : p.isCameraOff
            const muted = 'isSelf' in p && p.isSelf ? isMuted : p.isMuted

            return (
              <div
                key={p.id}
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-xl bg-navy-800 p-4',
                  'isSelf' in p && p.isSelf && 'ring-2 ring-primary/50',
                )}
              >
                {camOff ? (
                  <div className="flex size-16 items-center justify-center rounded-full bg-navy-700 text-lg font-semibold text-white">
                    {p.avatar}
                  </div>
                ) : (
                  <div className="flex size-full min-h-[120px] items-center justify-center rounded-lg bg-navy-700/80 text-sm text-navy-200">
                    {'isSelf' in p && p.isSelf ? 'Your camera' : `${p.name}'s camera`}
                  </div>
                )}

                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <span className="rounded-md bg-black/50 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
                    {p.name}
                    {'isSelf' in p && p.isSelf ? ' (You)' : ''}
                  </span>
                  {muted ? (
                    <span className="rounded-full bg-deadline-urgent/90 p-1">
                      <MicOff className="size-3 text-white" />
                    </span>
                  ) : null}
                  {camOff ? (
                    <span className="rounded-full bg-navy-600 p-1">
                      <VideoOff className="size-3 text-white" />
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Controls */}
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
