import { useCallback, useEffect, useState } from 'react'

import {
  registerPushToken,
  showLocalNotification,
  subscribeToForegroundMessages,
} from '@/lib/messaging'
import { useAuthUser } from '@/store/useAuthStore'

type NotificationPermissionState = NotificationPermission | 'unsupported'

export function usePushNotifications() {
  const user = useAuthUser()
  const [permission, setPermission] = useState<NotificationPermissionState>(() => {
    if (typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission
  })
  const [registering, setRegistering] = useState(false)
  const [enabled, setEnabled] = useState(false)

  const enableNotifications = useCallback(async () => {
    setRegistering(true)
    try {
      const success = await registerPushToken()
      setEnabled(success)
      if (typeof Notification !== 'undefined') {
        setPermission(Notification.permission)
      }
      return success
    } finally {
      setRegistering(false)
    }
  }, [])

  useEffect(() => {
    if (!user?.uid || !user.emailVerified) {
      setEnabled(false)
      return
    }

    if (typeof Notification === 'undefined') return

    if (Notification.permission === 'granted') {
      void registerPushToken().then(setEnabled)
    }
  }, [user?.uid, user?.emailVerified])

  useEffect(() => {
    if (!user?.uid || !user.emailVerified || !enabled) return

    let unsubscribe: (() => void) | null = null
    let cancelled = false

    void subscribeToForegroundMessages(({ title, body }) => {
      showLocalNotification(title, body, '/connect')
    }).then((unsub) => {
      if (cancelled) {
        unsub?.()
        return
      }
      unsubscribe = unsub
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [user?.uid, user?.emailVerified, enabled])

  const shouldPrompt =
    Boolean(user?.emailVerified) &&
    permission === 'default' &&
    !enabled &&
    typeof Notification !== 'undefined'

  return {
    permission,
    enabled,
    registering,
    shouldPrompt,
    enableNotifications,
  }
}
