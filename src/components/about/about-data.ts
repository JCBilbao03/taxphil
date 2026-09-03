import {
  Building2,
  Calculator,
  FileSpreadsheet,
  HeartHandshake,
  Landmark,
  LineChart,
  MessageCircle,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react'

type IconType = typeof ShieldCheck

export interface AboutSection {
  id: string
  label: string
}

export const aboutSections: AboutSection[] = [
  { id: 'mission', label: 'Our mission' },
  { id: 'values', label: 'What we stand for' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'expertise', label: 'How we help' },
]

export const aboutSectionIds = aboutSections.map((section) => section.id)

export const certifications = [
  'BIR eFPS Accredited',
  'ISO 27001 Certified',
  'DTI Registered',
] as const

export interface Milestone {
  id: string
  label: string
  /** Numeric targets animate on scroll; use `display` for non-numeric values. */
  value?: number
  display?: string
  suffix?: string
  icon: IconType
}

export const milestones: Milestone[] = [
  { id: 'taxpayers', label: 'Taxpayers served', value: 10000, suffix: '+', icon: Users },
  { id: 'forms', label: 'BIR forms supported', value: 50, suffix: '+', icon: FileSpreadsheet },
  { id: 'experience', label: 'Years of tax expertise', value: 15, suffix: '+', icon: LineChart },
  { id: 'support', label: 'Support availability', display: '24/7', icon: HeartHandshake },
]

export interface AboutValue {
  id: string
  icon: IconType
  title: string
  description: string
}

export const aboutValues: AboutValue[] = [
  {
    id: 'compliance',
    icon: ShieldCheck,
    title: 'Compliance first',
    description:
      'Every feature is built around Philippine tax law and BIR requirements so you file correctly the first time.',
  },
  {
    id: 'expertise',
    icon: HeartHandshake,
    title: 'Accessible expertise',
    description:
      'Licensed tax professionals and free consultations — expert help should not be reserved for large corporations.',
  },
  {
    id: 'clarity',
    icon: Target,
    title: 'Clarity over complexity',
    description:
      'Tax rules are complicated enough. We translate them into plain language, guided workflows, and real-time calculations.',
  },
  {
    id: 'local',
    icon: Users,
    title: 'Built for Filipino taxpayers',
    description:
      'From freelancers and sole proprietors to growing SMEs — TaxPhil is designed for how Philippine businesses actually work.',
  },
]

export interface TeamMember {
  id: string
  name: string
  initials: string
  image?: string
  role: string
  roleDetail?: string
  credentials?: string[]
  bio: string[]
  focusAreas?: string[]
  focusLabel?: string
  quote?: string
}

export const founder: TeamMember = {
  id: 'ulysis-borais',
  name: 'Ulysis Borais',
  initials: 'UB',
  image: '/team/ulysis-borais.jpg',
  role: 'Founder & CEO',
  roleDetail: 'Founder & Lead Consultant',
  credentials: ['CPA', 'FMVA'],
  bio: [
    'Ulysis Borais brings a dual-credentialed approach to corporate finance as a Certified Public Accountant (CPA) and a Financial Modeling & Valuation Analyst (FMVA). With a strong focus on strategic financial planning, Ulysis operates as a business consultant and fractional CFO, partnering with diverse enterprises to build robust financial infrastructures.',
    'His expertise spans across designing comprehensive corporate consultancy scopes, establishing rigorous financial compliance protocols, and structuring multi-tiered reporting cadences. From managing broad commercial portfolios to providing high-level tax advisory, Ulysis leverages his deep understanding of regulatory frameworks and financial modeling to deliver actionable insights and scalable solutions for his clients.',
  ],
  focusLabel: 'Core advisory pillars',
  focusAreas: [
    'Strategic financial planning',
    'Corporate consultancy scopes',
    'Financial compliance protocols',
    'Multi-tiered reporting cadences',
    'Commercial portfolio management',
    'High-level tax advisory',
  ],
  quote:
    'Partnering with diverse enterprises to build robust financial infrastructures — and deliver actionable, scalable solutions.',
}

export const executives: TeamMember[] = [
  {
    id: 'john-carlo-bilbao',
    name: 'John Carlo Bilbao',
    initials: 'JB',
    image: '/team/john-carlo-bilbao.jpg',
    role: 'Chief Technology Officer',
    bio: [
      "John Carlo Bilbao leads TaxPhil's technology strategy and product development, building the platform that makes BIR filing, real-time tax calculation, and online payments accessible to every Filipino taxpayer.",
    ],
    focusLabel: 'Technical focus',
    focusAreas: [
      'Secure & scalable infrastructure',
      'Real-time calculation engine',
      'BIR eFPS integrations',
    ],
  },
]

export const advisors: TeamMember[] = [
  {
    id: 'roger-nadado',
    name: 'Roger Nadado',
    initials: 'RN',
    image: '/team/roger-nadado.jpg',
    role: 'Fractional CFO Associate',
    bio: [
      'Roger Nadado supports TaxPhil clients with fractional CFO services — financial oversight, reporting structures, and strategic guidance for growing businesses that need senior finance leadership without a full-time hire.',
    ],
    focusLabel: 'Advisory focus',
    focusAreas: ['Financial oversight', 'Reporting structures', 'Strategic guidance'],
  },
  {
    id: 'nazmath-nazeer',
    name: 'Nazmath Nazeer',
    initials: 'NN',
    image: '/team/nazmath-nazeer.jpg',
    role: 'Fractional CFO Associate',
    roleDetail: 'CFO, telecom company in Sri Lanka',
    bio: [
      'Forward-looking with a commercial mindset to drive and execute organization transformation successfully — proactive custodians of shareholder value, finding the value, defining the strategy, enabling execution, and partnering for performance across the organization.',
      'Driving overall expansion plans for Starlink by making an impact in the market.',
    ],
    focusLabel: 'Advisory focus',
    focusAreas: ['Organization transformation', 'Strategic execution', 'Market expansion'],
  },
]

export interface ExpertiseItem {
  id: string
  icon: IconType
  title: string
  description: string
  href: string
  linkLabel: string
  highlight?: boolean
}

export const expertiseItems: ExpertiseItem[] = [
  {
    id: 'consultation',
    icon: MessageCircle,
    title: 'Free tax consultation',
    description:
      'Talk to a licensed expert about BIR compliance, filing requirements, and tax planning — at no cost.',
    href: '/#free-consultation',
    linkLabel: 'Book a session',
    highlight: true,
  },
  {
    id: 'filing',
    icon: Calculator,
    title: 'Online BIR filing',
    description:
      'Auto-generated 1701Q, 2551Q, and attachments with real-time tax computation and online payment.',
    href: '/#online-services',
    linkLabel: 'View services',
  },
  {
    id: 'registration',
    icon: Building2,
    title: 'Business registration',
    description:
      'DTI, SEC, and LGU registration handled end to end, including your BIR compliance setup.',
    href: '/#plans',
    linkLabel: 'See pricing',
  },
  {
    id: 'retainers',
    icon: Landmark,
    title: 'Accountant retainers',
    description:
      'Ongoing bookkeeping, financial reports, and compliance monitoring from licensed professionals.',
    href: '/#plans',
    linkLabel: 'See pricing',
  },
]
