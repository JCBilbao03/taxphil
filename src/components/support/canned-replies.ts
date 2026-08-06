export interface CannedReply {
  id: string
  label: string
  content: string
}

export const CANNED_REPLIES: CannedReply[] = [
  {
    id: 'received',
    label: 'Received',
    content:
      'Thanks for reaching out! We received your message and a support specialist will follow up shortly.',
  },
  {
    id: '1701q',
    label: '1701Q help',
    content:
      'For 1701Q filing, please confirm your income period and whether you need help with quarterly percentage tax or income tax. We can walk you through the steps in TaxPhil.',
  },
  {
    id: 'deadline',
    label: 'Deadline info',
    content:
      'BIR deadlines depend on your taxpayer type and form. Check the Tax Dues page in your dashboard for upcoming due dates, or tell us which form you are filing.',
  },
  {
    id: 'verify-email',
    label: 'Verify email',
    content:
      'Please verify your email address to unlock chat and filing features. You can resend the verification link from Settings or the verification page after signing in.',
  },
  {
    id: 'resolved',
    label: 'Resolved',
    content:
      'Glad we could help! If anything else comes up with your tax filing, message us anytime. Have a great day!',
  },
]
