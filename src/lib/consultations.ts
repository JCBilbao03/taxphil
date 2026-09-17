export type ConsultationKind = 'individual' | 'group'
export type ConsultationStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled' | 'declined'

export interface ConsultationRequest {
  kind: ConsultationKind
  topic: string
  notes: string
  preferredAt: string
  durationMinutes: number
  participants: number
}

export interface Consultation extends ConsultationRequest {
  id: string
  ownerUid: string
  ownerName: string
  ownerEmail: string
  status: ConsultationStatus
  createdAt: string
  updatedAt: string
  revision: number
  scheduledAt: string | null
  meetingUrl: string | null
  advisorName: string | null
  responseNote: string | null
}

export const CONSULTATION_STATUS: Record<ConsultationStatus, string> = {
  requested: 'Awaiting confirmation', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', declined: 'Declined',
}

function text(value: unknown, name: string, max: number, required = true): string {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
    throw new Error(`${name} ${required ? 'is required and' : ''} must be ${max} characters or fewer.`)
  }
  return value.trim()
}

function futureDate(value: unknown, now: number): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw new Error('Choose a valid date and time.')
  const time = Date.parse(value)
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value || time <= now) throw new Error('Choose a date and time in the future.')
  if (time > now + 180 * 86_400_000) throw new Error('Choose a date within the next 180 days.')
  return value
}

export function validateConsultationRequest(input: unknown, now = Date.now()): ConsultationRequest {
  if (!input || typeof input !== 'object') throw new Error('Consultation details are required.')
  const data = input as Record<string, unknown>
  if (data.kind !== 'individual' && data.kind !== 'group') throw new Error('Choose an individual or group consultation.')
  if (![30, 60].includes(data.durationMinutes as number)) throw new Error('Choose a 30 or 60 minute session.')
  const participants = data.participants as number
  if (!Number.isInteger(participants) || (data.kind === 'individual' ? participants !== 1 : participants < 2 || participants > 20)) {
    throw new Error('Individual sessions have 1 participant; group sessions have 2–20.')
  }
  return {
    kind: data.kind, topic: text(data.topic, 'Topic', 120), notes: text(data.notes, 'Notes', 2000, false),
    preferredAt: futureDate(data.preferredAt, now), durationMinutes: data.durationMinutes as number, participants,
  }
}

export function normalizeMeetingUrl(value: unknown): string {
  let url: URL
  try { url = new URL(typeof value === 'string' ? value.trim() : '') } catch { throw new Error('Enter a valid meeting URL.') }
  const host = url.hostname.toLowerCase()
  const allowed = host === 'meet.google.com' || host === 'zoom.us' || host.endsWith('.zoom.us') || host === 'teams.microsoft.com' || host === 'teams.live.com'
  if (!allowed || url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname.length < 2 || url.hash) {
    throw new Error('Use an HTTPS Google Meet, Zoom, or Microsoft Teams meeting link.')
  }
  return url.href
}

export type ConsultationAction =
  | { type: 'confirm'; scheduledAt: string; advisorName: string; meetingUrl: string; responseNote: string }
  | { type: 'cancel' | 'decline' | 'complete'; responseNote: string }

export function transitionConsultation(record: Consultation, action: ConsultationAction, actor: { uid: string; admin: boolean }, now = Date.now()): Consultation {
  if (!actor.admin && (record.ownerUid !== actor.uid || action.type !== 'cancel')) throw new Error('You do not have permission to update this consultation.')
  if (!['requested', 'confirmed'].includes(record.status)) throw new Error('This consultation is closed. Create a new request to arrange another session.')
  const responseNote = text(action.responseNote, 'Response note', 1000, action.type === 'decline')
  let patch: Partial<Consultation>
  if (action.type === 'confirm') {
    patch = {
      status: 'confirmed', scheduledAt: futureDate(action.scheduledAt, now),
      advisorName: text(action.advisorName, 'Advisor name', 120), meetingUrl: normalizeMeetingUrl(action.meetingUrl),
    }
  } else if (action.type === 'complete') {
    if (record.status !== 'confirmed' || !record.scheduledAt || Date.parse(record.scheduledAt) > now) throw new Error('Only a confirmed session that has started can be completed.')
    patch = { status: 'completed' }
  } else if (action.type === 'cancel') {
    patch = { status: 'cancelled', meetingUrl: null }
  } else if (action.type === 'decline') {
    patch = { status: 'declined', meetingUrl: null }
  } else {
    throw new Error('Unsupported consultation action.')
  }
  return { ...record, ...patch, responseNote, revision: record.revision + 1, updatedAt: new Date(now).toISOString() }
}

export function manilaDateTimeToISO(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Choose a valid Philippine date and time.')
  const date = new Date(`${value}:00+08:00`)
  if (!Number.isFinite(date.getTime()) || toManilaDateTime(date.toISOString()) !== value) throw new Error('Choose a valid Philippine date and time.')
  return date.toISOString()
}

export function toManilaDateTime(iso: string): string {
  return new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(0, 16)
}

export function formatConsultationDate(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(iso)) + ' PHT'
}

function calendarText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\r', '').replaceAll('\n', '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,')
}

export function consultationCalendar(record: Consultation): string {
  if (record.status !== 'confirmed' || !record.scheduledAt || !record.meetingUrl) throw new Error('Only confirmed consultations can be added to your calendar.')
  const meetingUrl = normalizeMeetingUrl(record.meetingUrl)
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TaxPhil//Consultations//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${calendarText(record.id)}@taxphil.com`, `DTSTAMP:${stamp(record.updatedAt)}`, `SEQUENCE:${record.revision}`,
    `DTSTART:${stamp(record.scheduledAt)}`, `DTEND:${stamp(new Date(Date.parse(record.scheduledAt) + record.durationMinutes * 60_000).toISOString())}`,
    `SUMMARY:${calendarText('TaxPhil consultation: ' + record.topic)}`, `DESCRIPTION:${calendarText(`Advisor: ${record.advisorName}\n${meetingUrl}`)}`,
    `URL:${meetingUrl}`, 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR']
  // Fold by UTF-8 octets (RFC 5545), without splitting a Unicode character.
  return lines.map((line) => {
    let result = ''; let width = 0
    for (const character of line) {
      const size = new TextEncoder().encode(character).length
      if (width + size > 74) { result += '\r\n '; width = 1 }
      result += character; width += size
    }
    return result
  }).join('\r\n') + '\r\n'
}
