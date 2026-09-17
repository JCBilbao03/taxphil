import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { consultationCalendar, manilaDateTimeToISO, normalizeMeetingUrl, toManilaDateTime, transitionConsultation, validateConsultationRequest, type Consultation } from '../src/lib/consultations.ts'

const now = Date.parse('2026-09-17T00:00:00.000Z')
const details = { kind: 'individual', topic: 'VAT review', notes: '', preferredAt: '2026-09-18T02:00:00.000Z', durationMinutes: 30, participants: 1 }
const record: Consultation = { ...validateConsultationRequest(details, now), id: 'abc-123', ownerUid: 'alice', ownerName: 'Alice', ownerEmail: 'alice@example.test', status: 'requested', revision: 0, createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), scheduledAt: null, advisorName: null, meetingUrl: null, responseNote: null }
const confirmation = { type: 'confirm' as const, scheduledAt: details.preferredAt, advisorName: 'Advisor A', meetingUrl: 'https://meet.google.com/abc-defg-hij', responseNote: '' }
const admin = { uid: 'staff', admin: true }

test('consultation validation requires future bounded real dates and valid group size', () => {
  assert.equal(validateConsultationRequest({ ...details, topic: ' VAT review ' }, now).topic, 'VAT review')
  for (const patch of [{ preferredAt: '2026-02-30T00:00:00.000Z' }, { preferredAt: new Date(now).toISOString() }, { preferredAt: '2028-01-01T00:00:00.000Z' }, { participants: 2 }, { durationMinutes: 25 }, { kind: 'group', participants: 1 }, { kind: 'group', participants: 21 }, { topic: ' ' }, { notes: 'a'.repeat(2001) }]) {
    assert.throws(() => validateConsultationRequest({ ...details, ...patch }, now))
  }
  assert.equal(validateConsultationRequest({ ...details, kind: 'group', participants: 20, durationMinutes: 60 }, now).participants, 20)
})

test('Philippine dates round trip without dependence on browser timezone', () => {
  assert.equal(manilaDateTimeToISO('2026-09-18T10:00'), details.preferredAt)
  assert.equal(toManilaDateTime(details.preferredAt), '2026-09-18T10:00')
  assert.equal(manilaDateTimeToISO('2026-01-01T00:30'), '2025-12-31T16:30:00.000Z')
  assert.throws(() => manilaDateTimeToISO('2026-02-30T10:00'))
  assert.throws(() => manilaDateTimeToISO('2026-09-18T25:00'))
})

test('meeting links reject scripts, credentials, lookalike hosts and non-HTTPS URLs', () => {
  for (const url of ['javascript:alert(1)', 'https://zoom.us.evil.test/j/123', 'https://meet.google.com@evil.test/room', 'https://user:password@zoom.us/j/123', 'http://zoom.us/j/123', 'https://evilzoom.us/j/123', 'https://meet.google.com/', 'https://zoom.us/j/123#script', 'https://zoom.us:3000/j/123']) {
    assert.throws(() => normalizeMeetingUrl(url))
  }
  for (const url of ['https://meet.google.com/abc-defg-hij', 'https://us02web.zoom.us/j/123?pwd=abc', 'https://teams.microsoft.com/l/meetup-join/abc']) assert.equal(normalizeMeetingUrl(url), url)
})

test('customer can cancel their own request but cannot confirm or touch another customer', () => {
  assert.throws(() => transitionConsultation(record, confirmation, { uid: 'alice', admin: false }, now), /permission/)
  assert.throws(() => transitionConsultation(record, { type: 'cancel', responseNote: '' }, { uid: 'bob', admin: false }, now), /permission/)
  const cancelled = transitionConsultation(record, { type: 'cancel', responseNote: '' }, { uid: 'alice', admin: false }, now)
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.revision, 1)
  assert.equal(record.status, 'requested')
})

test('confirmed sessions require a real schedule and meeting details, and update the revision', () => {
  const confirmed = transitionConsultation(record, confirmation, admin, now)
  assert.equal(confirmed.status, 'confirmed'); assert.equal(confirmed.scheduledAt, details.preferredAt); assert.equal(confirmed.revision, 1)
  assert.throws(() => transitionConsultation(record, { ...confirmation, advisorName: '' }, admin, now))
  assert.throws(() => transitionConsultation(record, { ...confirmation, meetingUrl: '' }, admin, now))
  const cancelled = transitionConsultation(confirmed, { type: 'cancel', responseNote: '' }, { uid: 'alice', admin: false }, now)
  assert.equal(cancelled.meetingUrl, null)
})

test('declines need a reason and terminal states cannot be reopened', () => {
  assert.throws(() => transitionConsultation(record, { type: 'decline', responseNote: '' }, admin, now))
  const declined = transitionConsultation(record, { type: 'decline', responseNote: 'Requested time unavailable' }, admin, now)
  assert.equal(declined.status, 'declined')
  assert.throws(() => transitionConsultation(declined, confirmation, admin, now), /closed/)
})

test('completion cannot be claimed before a confirmed session starts', () => {
  const action = { type: 'complete' as const, responseNote: 'Completed review' }
  assert.throws(() => transitionConsultation(record, action, admin, now), /confirmed/)
  const confirmed = transitionConsultation(record, confirmation, admin, now)
  assert.throws(() => transitionConsultation(confirmed, action, admin, now), /started/)
  assert.equal(transitionConsultation(confirmed, action, admin, Date.parse(details.preferredAt) + 1000).status, 'completed')
})

test('calendar export carries UTC time, duration, stable UID, revision and escaped text', () => {
  const confirmed = transitionConsultation({ ...record, topic: 'Sales, VAT; review\n第二行'.repeat(5) }, confirmation, admin, now)
  const calendar = consultationCalendar(confirmed)
  assert.match(calendar, /DTSTART:20260918T020000Z/)
  assert.match(calendar, /DTEND:20260918T023000Z/)
  assert.match(calendar, /UID:abc-123@taxphil.com/)
  assert.match(calendar, /SEQUENCE:1/)
  assert.match(calendar, /Sales\\, VAT\\; review\\n/)
  for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75)
  assert.throws(() => consultationCalendar(record))
  assert.throws(() => consultationCalendar({ ...confirmed, meetingUrl: 'javascript:alert(1)' }))
})

test('backend validation uses the same reviewed consultation model', () => {
  assert.equal(readFileSync(new URL('../src/lib/consultations.ts', import.meta.url), 'utf8'), readFileSync(new URL('../functions/src/consultation-model.ts', import.meta.url), 'utf8'))
})
