import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePersonalProfile, normalizePersonalRegistration } from '../src/lib/profile-validation.ts'

test('personal profile preserves leading zeroes and normalizes optional branch formats', () => {
  assert.deepEqual(normalizePersonalProfile({ fullName: '  Maria Santos  ', tin: '00100200300000', businessName: ' Sample ' }), { fullName: 'Maria Santos', tin: '001-002-003-00000', businessName: 'Sample' })
  assert.equal(normalizePersonalProfile({ fullName: 'Maria', tin: '001-002-003-000', businessName: '' }).tin, '001-002-003-000')
  assert.equal(normalizePersonalProfile({ fullName: 'Maria', tin: '', businessName: '' }).tin, '')
})
test('invalid personal identifiers and empty names are rejected', () => {
  for (const tin of ['12345678', '123456789X', '1234567890', '1234567890123']) assert.throws(() => normalizePersonalProfile({ fullName: 'Maria', tin, businessName: '' }))
  assert.throws(() => normalizePersonalProfile({ fullName: '  ', tin: '', businessName: '' }))
})
test('registration supports district letter suffixes and explicit reviewed categories', () => {
  assert.deepEqual(normalizePersonalRegistration({ taxType: 'Self-employed / Professional', rdo: ' 008a ' }), { taxType: 'Self-employed / Professional', rdo: '008A' })
  assert.throws(() => normalizePersonalRegistration({ taxType: 'anything', rdo: '039' }))
  assert.throws(() => normalizePersonalRegistration({ taxType: 'Sole proprietor', rdo: '39 arbitrary text' }))
})
