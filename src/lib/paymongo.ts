import { httpsCallable } from 'firebase/functions'

import { functions } from '@/lib/firebase'
import { paymongoCheckoutUrl, type AssistanceCheckoutInput } from '@/lib/permit-payments'

export type CreatePermitCheckoutInput = AssistanceCheckoutInput

export interface CreatePermitCheckoutResult {
  checkoutUrl: string
  permitId: string
  paymentId: string
  livemode: boolean
}

export async function createPermitCheckout(
  input: CreatePermitCheckoutInput,
): Promise<CreatePermitCheckoutResult> {
  const callable = httpsCallable<
    CreatePermitCheckoutInput,
    CreatePermitCheckoutResult
  >(functions, 'createPermitCheckout')

  const response = await callable(input)
  return { ...response.data, checkoutUrl: paymongoCheckoutUrl(response.data.checkoutUrl) }
}

export async function refreshPermitPayment(permitId: string): Promise<{ status: string; checkoutUrl: string | null }> {
  const response = await httpsCallable<{ permitId: string }, { status: string; checkoutUrl: string | null }>(functions, 'refreshPermitPayment')({ permitId })
  return { ...response.data, checkoutUrl: response.data.checkoutUrl ? paymongoCheckoutUrl(response.data.checkoutUrl) : null }
}
