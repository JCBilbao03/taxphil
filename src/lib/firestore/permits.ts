import {
  collection,
  onSnapshot,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import {
  paymentsCollectionPath,
  permitsCollectionPath,
} from '@/lib/firestore/paths'
import type {
  PaymentStatus,
  Permit,
  PermitPayment,
  PermitStatus,
  PermitType,
} from '@/store/usePermitStore'

export interface PermitDocument {
  businessName: string
  lgu: string
  permitType: PermitType
  year: number
  amount: number
  status: PermitStatus
  paymentId: string
  assistanceReference?: string
  purpose?: string
  livemode?: boolean
  checkoutUrl?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PaymentDocument {
  permitId: string
  amount: number
  amountCentavos: number
  currency: 'PHP'
  status: PaymentStatus
  channel?: string
  paymongoCheckoutId: string
  paymongoPaymentId?: string
  referenceNumber: string
  paidAt?: Timestamp
  assistanceReference?: string
  purpose?: string
  livemode?: boolean
  checkoutUrl?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

function permitsRef(userId: string) {
  return collection(db, permitsCollectionPath(userId))
}

function paymentsRef(userId: string) {
  return collection(db, paymentsCollectionPath(userId))
}

function timestampToIso(value: Timestamp | undefined): string {
  return value?.toDate().toISOString() ?? new Date(0).toISOString()
}

function mapPermitDocument(id: string, data: PermitDocument): Permit {
  return {
    id,
    businessName: data.businessName,
    lgu: data.lgu,
    permitType: data.permitType,
    year: data.year,
    amount: data.amount,
    status: data.status,
    paymentId: data.paymentId,
    assistanceReference: data.assistanceReference,
    purpose: data.purpose,
    livemode: data.livemode,
    checkoutUrl: data.checkoutUrl,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  }
}

function mapPaymentDocument(id: string, data: PaymentDocument): PermitPayment {
  return {
    id,
    permitId: data.permitId,
    amount: data.amount,
    amountCentavos: data.amountCentavos,
    currency: data.currency,
    status: data.status,
    channel: data.channel,
    paymongoCheckoutId: data.paymongoCheckoutId,
    paymongoPaymentId: data.paymongoPaymentId,
    referenceNumber: data.referenceNumber,
    paidAt: data.paidAt ? timestampToIso(data.paidAt) : undefined,
    assistanceReference: data.assistanceReference,
    purpose: data.purpose,
    livemode: data.livemode,
    checkoutUrl: data.checkoutUrl,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  }
}

export function subscribeToPermits(
  userId: string,
  onData: (permits: Permit[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    permitsRef(userId),
    (snapshot) => {
      const permits = snapshot.docs.map((docSnap) =>
        mapPermitDocument(docSnap.id, docSnap.data() as PermitDocument),
      )
      onData(permits)
    },
    (error) => onError(error),
  )
}

export function subscribeToPayments(
  userId: string,
  onData: (payments: PermitPayment[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    paymentsRef(userId),
    (snapshot) => {
      const payments = snapshot.docs.map((docSnap) =>
        mapPaymentDocument(docSnap.id, docSnap.data() as PaymentDocument),
      )
      onData(payments)
    },
    (error) => onError(error),
  )
}
