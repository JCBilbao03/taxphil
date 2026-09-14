import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { userDocPath } from '@/lib/firestore/paths'

export interface UserProfileDocument {
  email: string
  displayName: string
  fullName?: string
  tin?: string
  businessName?: string
  taxType?: string
  rdo?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface UserProfileInput {
  email: string
  displayName: string
  fullName?: string
  tin?: string
  businessName?: string
  taxType?: string
  rdo?: string
}

export interface ProfileFormData {
  fullName: string
  tin: string
  businessName: string
  taxType: string
  rdo: string
}

function userDocRef(userId: string) {
  return doc(db, userDocPath(userId))
}

export async function createUserProfile(
  userId: string,
  profile: UserProfileInput,
): Promise<void> {
  await setDoc(userDocRef(userId), {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function getUserProfile(
  userId: string,
): Promise<UserProfileDocument | null> {
  const snapshot = await getDoc(userDocRef(userId))
  if (!snapshot.exists()) return null
  return snapshot.data() as UserProfileDocument
}

async function ensureUserProfileDocument(
  userId: string,
  defaults: UserProfileInput,
): Promise<void> {
  const existing = await getUserProfile(userId)
  if (existing) return
  await createUserProfile(userId, defaults)
}

export async function updateUserProfile(
  userId: string,
  defaults: UserProfileInput,
  updates: Partial<ProfileFormData>,
): Promise<void> {
  await ensureUserProfileDocument(userId, defaults)

  const payload: Record<string, string> = {}

  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'string') {
      payload[key] = value.trim()
    }
  }

  await updateDoc(userDocRef(userId), {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function updateUserRegistration(
  userId: string,
  defaults: UserProfileInput,
  registration: Pick<ProfileFormData, 'taxType' | 'rdo'>,
): Promise<void> {
  await ensureUserProfileDocument(userId, defaults)

  await updateDoc(userDocRef(userId), {
    taxType: registration.taxType.trim(),
    rdo: registration.rdo.trim(),
    updatedAt: serverTimestamp(),
  })
}
