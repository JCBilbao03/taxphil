import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging'
import { get, push, ref, remove, set } from 'firebase/database'

import app, { auth, rtdb } from '@/lib/firebase'

let messagingInstance: Messaging | null | undefined

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance !== undefined) {
    return messagingInstance
  }

  const supported = await isSupported()
  if (!supported) {
    messagingInstance = null
    return null
  }

  messagingInstance = getMessaging(app)
  return messagingInstance
}

function tokenStoragePath(userId: string, tokenId: string) {
  return `users/${userId}/fcmTokens/${tokenId}`
}

export async function registerPushToken(): Promise<boolean> {
  const user = auth.currentUser
  if (!user?.emailVerified) return false

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    console.warn('VITE_FIREBASE_VAPID_KEY is not configured; push notifications disabled.')
    return false
  }

  const messaging = await getMessagingInstance()
  if (!messaging) return false

  if (Notification.permission === 'denied') {
    return false
  }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/',
  })

  await navigator.serviceWorker.ready

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  })

  if (!token) return false

  const tokenRef = push(ref(rtdb, `users/${user.uid}/fcmTokens`))
  await set(tokenRef, {
    token,
    updatedAt: Date.now(),
    userAgent: navigator.userAgent.slice(0, 200),
  })

  return true
}

export async function unregisterPushTokens(): Promise<void> {
  const user = auth.currentUser
  if (!user) return

  const snapshot = await get(ref(rtdb, `users/${user.uid}/fcmTokens`))
  const tokens = snapshot.val() as Record<string, { token?: string }> | null

  if (!tokens) return

  await Promise.all(
    Object.keys(tokens).map((tokenId) =>
      remove(ref(rtdb, tokenStoragePath(user.uid, tokenId))),
    ),
  )
}

export async function subscribeToForegroundMessages(
  handler: (payload: { title: string; body: string }) => void,
): Promise<(() => void) | null> {
  const messaging = await getMessagingInstance()
  if (!messaging) return null

  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'TaxPhil Support'
    const body =
      payload.notification?.body ??
      payload.data?.body ??
      'You have a new message.'

    handler({ title, body })
  })
}

export function showLocalNotification(title: string, body: string, url = '/connect') {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return
  }

  const notification = new Notification(title, {
    body,
    icon: '/favicon.svg',
    tag: 'taxphil-support',
  })

  notification.onclick = () => {
    window.focus()
    window.location.assign(url)
    notification.close()
  }
}
