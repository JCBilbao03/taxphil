import { httpsCallable } from 'firebase/functions'

import { functions } from '@/lib/firebase'
import type { PermitType } from '@/store/usePermitStore'

export interface CreatePermitCheckoutInput {
  businessName?: string
  lgu: string
  permitType: PermitType
  year: number
  amount: number
}

export interface CreatePermitCheckoutResult {
  checkoutUrl: string
  permitId: string
  paymentId: string
}

export async function createPermitCheckout(
  input: CreatePermitCheckoutInput,
): Promise<CreatePermitCheckoutResult> {
  const callable = httpsCallable<
    CreatePermitCheckoutInput,
    CreatePermitCheckoutResult
  >(functions, 'createPermitCheckout')

  const response = await callable(input)
  return response.data
}
