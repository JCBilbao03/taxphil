import { useCallback, useEffect, useState } from 'react'
import { Clock, Star, Video, VideoOff } from 'lucide-react'

import { CallControls } from '@/components/connect/CallControls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useConnectStore } from '@/store/useConnectStore'
import { cn } from '@/lib/utils'

const experts = [
  {
    id: 'expert-1',
    name: 'Maria Santos',
    role: 'Senior Tax Expert',
    avatar: 'MS',
    rating: 4.9,
    reviews: 128,
    specialty: 'Self-employed & 2551Q',
    available: true,
  },
  {
    id: 'expert-2',
    name: 'Carlo Mendoza',
    role: 'BIR Compliance Advisor',
    avatar: 'CM',
    rating: 4.8,
    reviews: 94,
    specialty: '1701Q & Annual ITR',
    available: true,
  },
  {
    id: 'expert-3',
    name: 'Ana Reyes',
    role: 'Corporate Tax Specialist',
    avatar: 'AR',
    rating: 4.9,
    reviews: 76,
    specialty: '1702Q & Withholding',
    available: false,
  },
] as const

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function VideoCallView() {
  const callStatus = useConnectStore((state) => state.callStatus)
  const setCallStatus = useConnectStore((state) => state.setCallStatus)
  const isMuted = useConnectStore((state) => state.isMuted)
  const isCameraOff = useConnectStore((state) => state.isCameraOff)
  const isScreenSharing = useConnectStore((state) => state.isScreenSharing)
  const toggleMute = useConnectStore((state) => state.toggleMute)
  const toggleCamera = useConnectStore((state) => state.toggleCamera)
  const toggleScreenShare = useConnectStore((state) => state.toggleScreenShare)

  const [selectedExpert, setSelectedExpert] = useState<string>(experts[0].id)
  const [duration, setDuration] = useState(0)

  const expert = experts.find((e) => e.id === selectedExpert) ?? experts[0]

  useEffect(() => {
    if (callStatus !== 'active') return
    const interval = setInterval(() => setDuration((d) => d + 1), 1000)
    return () => clearInterval(interval)
  }, [callStatus])

  const startCall = useCallback(() => {
    setDuration(0)
    setCallStatus('connecting')
    setTimeout(() => setCallStatus('active'), 1800)
  }, [setCallStatus])

  const endCall = useCallback(() => {
    setCallStatus('ended')
    setTimeout(() => setCallStatus('idle'), 1500)
  }, [setCallStatus])

  if (callStatus === 'idle' || callStatus === 'ended') {
    return (
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Start a video call</CardTitle>
            <CardDescription>
              Connect 1-on-1 with a certified TaxPhil tax expert for personalized
              guidance on your BIR filings.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {experts.map((exp) => (
            <button
              key={exp.id}
              type="button"
              disabled={!exp.available}
              onClick={() => setSelectedExpert(exp.id)}
              className={cn(
                'rounded-xl border bg-white p-5 text-left shadow-sm transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50',
                selectedExpert === exp.id
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border',
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {exp.avatar}
                </div>
                {exp.available ? (
                  <Badge
                    variant="outline"
                    className="border-deadline-safe/30 bg-deadline-safe-bg text-deadline-safe"
                  >
                    Available
                  </Badge>
                ) : (
                  <Badge variant="outline">Busy</Badge>
                )}
              </div>
              <p className="mt-4 font-semibold text-foreground">{exp.name}</p>
              <p className="text-xs text-muted-foreground">{exp.role}</p>
              <p className="mt-2 text-xs text-primary">{exp.specialty}</p>
              <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="size-3 fill-deadline-warning text-deadline-warning" />
                {exp.rating} ({exp.reviews} reviews)
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            className="gap-2 px-8"
            disabled={!expert.available}
            onClick={startCall}
          >
            <Video className="size-4" />
            Start video call with {expert.name.split(' ')[0]}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-navy-900 shadow-lg">
      {/* Main video area */}
      <div className="relative flex aspect-video items-center justify-center bg-navy-800">
        {callStatus === 'connecting' ? (
          <div className="text-center">
            <div className="mx-auto size-16 animate-pulse rounded-full bg-primary/30" />
            <p className="mt-4 text-sm text-navy-200">Connecting to {expert.name}...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-28 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground ring-4 ring-white/10">
                {expert.avatar}
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-white">{expert.name}</p>
                <p className="text-sm text-navy-300">{expert.role}</p>
              </div>
            </div>

            {/* Self PiP */}
            <div className="absolute right-4 bottom-4 overflow-hidden rounded-lg border-2 border-white/20 bg-navy-700 shadow-xl">
              <div className="flex h-28 w-40 items-center justify-center">
                {isCameraOff ? (
                  <div className="flex flex-col items-center gap-1 text-navy-300">
                    <VideoOff className="size-5" />
                    <span className="text-[10px]">Camera off</span>
                  </div>
                ) : (
                  <div className="flex size-full items-center justify-center bg-navy-600 text-sm font-medium text-white">
                    You
                  </div>
                )}
              </div>
            </div>

            {/* Call info bar */}
            <div className="absolute top-4 left-4 flex items-center gap-3">
              <Badge className="bg-deadline-urgent/90 text-white hover:bg-deadline-urgent">
                LIVE
              </Badge>
              <span className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-xs text-white backdrop-blur-sm">
                <Clock className="size-3" />
                {formatDuration(duration)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center p-6">
        <CallControls
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isScreenSharing={isScreenSharing}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onToggleScreenShare={toggleScreenShare}
          onEndCall={endCall}
        />
      </div>
    </div>
  )
}
