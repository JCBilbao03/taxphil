import type { PermitStatus, PaymentStatus } from '@/store/usePermitStore'

export function permitStatusLabel(status: PermitStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending payment'
    case 'paid':
      return 'Paid'
    case 'failed':
      return 'Failed'
    case 'expired':
      return 'Expired'
  }
}

export function permitStatusClass(status: PermitStatus): string {
  switch (status) {
    case 'paid':
      return 'bg-deadline-safe-bg text-deadline-safe border-deadline-safe/20'
    case 'pending':
      return 'bg-deadline-warning-bg text-deadline-warning border-deadline-warning/20'
    case 'failed':
    case 'expired':
      return 'bg-deadline-urgent-bg text-deadline-urgent border-deadline-urgent/20'
  }
}

export function paymentChannelLabel(channel?: string): string {
  if (!channel) return 'Online payment'
  switch (channel) {
    case 'gcash':
      return 'GCash'
    case 'paymaya':
      return 'Maya'
    case 'card':
      return 'Card'
    default:
      return channel
  }
}

export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'pending':
      return 'Awaiting payment'
    case 'paid':
      return 'Confirmed'
    case 'failed':
      return 'Failed'
    case 'expired':
      return 'Expired'
    case 'superseded':
      return 'Superseded'
  }
}
