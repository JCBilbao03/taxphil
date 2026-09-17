import { create } from 'zustand'

export type PermitType = 'new' | 'renewal'

export type PermitStatus = 'pending' | 'paid' | 'failed' | 'expired'

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'superseded'

export interface Permit {
  id: string
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
  createdAt: string
  updatedAt: string
}

export interface PermitPayment {
  id: string
  permitId: string
  amount: number
  amountCentavos: number
  currency: 'PHP'
  status: PaymentStatus
  channel?: string
  paymongoCheckoutId: string
  paymongoPaymentId?: string
  referenceNumber: string
  paidAt?: string
  assistanceReference?: string
  purpose?: string
  livemode?: boolean
  checkoutUrl?: string
  createdAt: string
  updatedAt: string
}

interface PermitState {
  permits: Permit[]
  payments: PermitPayment[]
  loading: boolean
  error: string | null
  pendingPermits: () => Permit[]
  paidPermits: () => Permit[]
  getPermitById: (permitId: string) => Permit | undefined
  getPaymentByPermitId: (permitId: string) => PermitPayment | undefined
  setPermits: (permits: Permit[]) => void
  setPayments: (payments: PermitPayment[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const usePermitStore = create<PermitState>((set, get) => ({
  permits: [],
  payments: [],
  loading: false,
  error: null,

  pendingPermits: () =>
    get().permits.filter((permit) => permit.status === 'pending'),

  paidPermits: () =>
    get().permits.filter((permit) => permit.status === 'paid'),

  getPermitById: (permitId) =>
    get().permits.find((permit) => permit.id === permitId),

  getPaymentByPermitId: (permitId) => {
    const permit = get().permits.find((item) => item.id === permitId)
    if (!permit) return undefined
    return get().payments.find((payment) => payment.id === permit.paymentId)
  },

  setPermits: (permits) => set({ permits }),
  setPayments: (payments) => set({ payments }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
