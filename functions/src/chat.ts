import { getAuth } from 'firebase-admin/auth'
import { getDatabase, ServerValue } from 'firebase-admin/database'
import { getMessaging } from 'firebase-admin/messaging'
import { onValueCreated } from 'firebase-functions/v2/database'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

export const SUPPORT_CONVERSATION_ID = 'support'
export const SUPPORT_SENDER_ID = 'support'

// Default RTDB instances are in us-central1; triggers must match the DB region.
const RTDB_INSTANCE = 'philtax-default-rtdb'
const RTDB_REGION = 'us-central1'
const CALLABLE_REGION = 'asia-southeast1'

const AUTO_REPLY_MESSAGE =
  'Thanks for reaching out! A TaxPhil support specialist will review your message and respond within 24 hours.'

function getSupportAdminEmails(): string[] {
  return (process.env.SUPPORT_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isSupportAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getSupportAdminEmails().includes(email.toLowerCase())
}

function assertSupportAdmin(auth: { uid: string; token: Record<string, unknown> }) {
  const email = typeof auth.token.email === 'string' ? auth.token.email : null
  const hasClaim = auth.token.admin === true

  if (!hasClaim && !isSupportAdminEmail(email)) {
    throw new HttpsError('permission-denied', 'Support admin access required.')
  }
}

async function sendSupportMessage(
  userId: string,
  conversationId: string,
  content: string,
  senderName: string,
  incrementUserUnread: boolean,
) {
  const db = getDatabase()
  const messagesRef = db.ref(`chats/${userId}/messages/${conversationId}`)
  const conversationRef = db.ref(
    `chats/${userId}/conversations/${conversationId}`,
  )

  await messagesRef.push({
    senderId: SUPPORT_SENDER_ID,
    senderName,
    content,
    createdAt: ServerValue.TIMESTAMP,
  })

  await conversationRef.transaction((current) => {
    if (!current) return current

    return {
      ...current,
      lastMessage: content,
      lastMessageAt: ServerValue.TIMESTAMP,
      unread: incrementUserUnread ? (current.unread ?? 0) + 1 : current.unread ?? 0,
    }
  })

  if (incrementUserUnread) {
    await notifyUserOfSupportReply(userId, senderName, content)
  }
}

async function notifyUserOfSupportReply(
  userId: string,
  senderName: string,
  content: string,
) {
  const db = getDatabase()
  const tokensSnap = await db.ref(`users/${userId}/fcmTokens`).get()
  const tokenRecords = tokensSnap.val() as
    | Record<string, { token?: string }>
    | null

  if (!tokenRecords) return

  const tokens = Object.entries(tokenRecords)
    .map(([tokenId, record]) => ({ tokenId, token: record.token }))
    .filter((entry): entry is { tokenId: string; token: string } =>
      Boolean(entry.token),
    )

  if (tokens.length === 0) return

  const preview =
    content.length > 120 ? `${content.slice(0, 117).trimEnd()}...` : content

  const response = await getMessaging().sendEachForMulticast({
    tokens: tokens.map((entry) => entry.token),
    notification: {
      title: senderName || 'TaxPhil Support',
      body: preview,
    },
    data: {
      type: 'support_reply',
      url: '/connect',
    },
    webpush: {
      fcmOptions: {
        link: '/connect',
      },
    },
  })

  const invalidTokenIds: string[] = []

  response.responses.forEach((result, index) => {
    if (result.success) return

    const errorCode = result.error?.code
    if (
      errorCode === 'messaging/invalid-registration-token' ||
      errorCode === 'messaging/registration-token-not-registered'
    ) {
      invalidTokenIds.push(tokens[index]?.tokenId ?? '')
    }
  })

  await Promise.all(
    invalidTokenIds
      .filter(Boolean)
      .map((tokenId) =>
        db.ref(`users/${userId}/fcmTokens/${tokenId}`).remove(),
      ),
  )
}

export const onSupportMessageCreated = onValueCreated(
  {
    ref: '/chats/{userId}/messages/support/{messageId}',
    instance: RTDB_INSTANCE,
    region: RTDB_REGION,
  },
  async (event) => {
    const userId = event.params.userId
    const message = event.data.val() as {
      senderId?: string
      senderName?: string
      content?: string
    } | null

    if (!message?.content || !message.senderId) return

    // Ignore support/system messages
    if (message.senderId !== userId) return

    const db = getDatabase()
    const inboxRef = db.ref(`supportInbox/${userId}`)

    let userEmail = ''
    let displayName = message.senderName ?? 'User'

    try {
      const userRecord = await getAuth().getUser(userId)
      userEmail = userRecord.email ?? ''
      displayName = userRecord.displayName ?? displayName
    } catch (error) {
      console.error('Failed to load user for support inbox', userId, error)
    }

    await inboxRef.transaction((current) => {
      const unread = (current?.unread ?? 0) + 1

      return {
        userId,
        userEmail,
        displayName,
        conversationId: SUPPORT_CONVERSATION_ID,
        lastMessage: message.content,
        lastMessageAt: ServerValue.TIMESTAMP,
        unread,
      }
    })

    const messagesSnap = await db
      .ref(`chats/${userId}/messages/${SUPPORT_CONVERSATION_ID}`)
      .get()

    let userMessageCount = 0
    messagesSnap.forEach((child) => {
      const senderId = child.val()?.senderId
      if (senderId === userId) userMessageCount += 1
    })

    if (userMessageCount === 1) {
      await sendSupportMessage(
        userId,
        SUPPORT_CONVERSATION_ID,
        AUTO_REPLY_MESSAGE,
        'TaxPhil Support',
        true,
      )
    }
  },
)

export const syncSupportAdmin = onCall({ region: CALLABLE_REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.')
  }

  const email =
    typeof request.auth.token.email === 'string'
      ? request.auth.token.email
      : null

  if (!isSupportAdminEmail(email)) {
    throw new HttpsError(
      'permission-denied',
      'This account is not authorized for support admin access.',
    )
  }

  await getAuth().setCustomUserClaims(request.auth.uid, { admin: true })

  await getDatabase().ref(`supportAdmins/${request.auth.uid}`).set({
    email,
    syncedAt: ServerValue.TIMESTAMP,
  })

  return { admin: true }
})

export const sendSupportReply = onCall({ region: CALLABLE_REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.')
  }

  assertSupportAdmin(request.auth)

  const userId =
    typeof request.data?.userId === 'string' ? request.data.userId.trim() : ''
  const content =
    typeof request.data?.content === 'string' ? request.data.content.trim() : ''
  const conversationId =
    typeof request.data?.conversationId === 'string'
      ? request.data.conversationId.trim()
      : SUPPORT_CONVERSATION_ID

  if (!userId || !content) {
    throw new HttpsError(
      'invalid-argument',
      'userId and content are required.',
    )
  }

  if (content.length > 4000) {
    throw new HttpsError(
      'invalid-argument',
      'Message must be 4000 characters or fewer.',
    )
  }

  const senderName =
    typeof request.auth.token.name === 'string' &&
    request.auth.token.name.trim().length > 0
      ? request.auth.token.name
      : 'TaxPhil Support'

  await sendSupportMessage(userId, conversationId, content, senderName, true)

  await getDatabase().ref(`supportInbox/${userId}`).update({
    lastMessage: content,
    lastMessageAt: ServerValue.TIMESTAMP,
  })

  return { success: true }
})

export const markSupportInboxRead = onCall({ region: CALLABLE_REGION }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in.')
  }

  assertSupportAdmin(request.auth)

  const userId =
    typeof request.data?.userId === 'string' ? request.data.userId.trim() : ''

  if (!userId) {
    throw new HttpsError('invalid-argument', 'userId is required.')
  }

  await getDatabase().ref(`supportInbox/${userId}/unread`).set(0)

  return { success: true }
})
