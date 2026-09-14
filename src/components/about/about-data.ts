import {
  Building2,
  Calculator,
  HeartHandshake,
  Landmark,
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

export const milestones: Milestone[] = []

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
    role: 'Fractional CFO Consultant',
    roleDetail: 'Chief Financial Officer · MBK Holding',
    bio: [
      'Roger Nadado is Chief Financial Officer of MBK Holding in Doha, Qatar, where he has led the finance function for over a decade — setting the financial controls, reporting standards, and compliance discipline that keep obligations accurate and filings on schedule.',
      'Before MBK, he spent nearly six years as Supervisor at Moore Stephens Qatar, delivering consulting and business advisory services including outsourced accounting, financial statement preparation, compliance engagements, internal audit, financial modeling, and merger-and-acquisition support. He began his career as Associate Auditor at Sycip, Gorres, Velayo (SGV) & Co. — a member practice of Ernst & Young Global — grounding his CFO work in rigorous audit and assurance standards.',
    ],
    focusLabel: 'CFO expertise',
    focusAreas: [
      'Chief Financial Officer leadership',
      'Compliance & assurance engagements',
      'Financial reporting & analysis',
      'Business advisory & due diligence',
      'Budgeting, forecasting & modeling',
    ],
  },
  {
    id: 'nazmath-nazeer',
    name: 'Nazmath Nazeer',
    initials: 'NN',
    image: '/team/nazmath-nazeer.jpg',
    role: 'Fractional CFO Consultant',
    roleDetail: 'Chief Financial Officer · MBK Holding',
    bio: [
      'Nazmath Nazeer is a Chief Financial Officer with deep experience leading finance, asset management, and compliance-ready reporting across the Middle East and global markets. As CFO at Starlink ME for over five years, he oversaw financial operations across Qatar, Oman, Kuwait, Saudi Arabia, Egypt, and Dubai — building the controls and reporting cadences that keep tax obligations accurate and filings on track.',
      'He currently serves as CFO for MBK Holding and Sponixtech, with additional CFO and senior advisory roles at DVCOM Technology and Feedback. That multi-company CFO perspective — financial oversight, shareholder stewardship, and execution at scale — is exactly what TaxPhil clients need when translating complex tax rules into clear, actionable decisions.',
    ],
    focusLabel: 'CFO expertise',
    focusAreas: [
      'Chief Financial Officer leadership',
      'Asset management & financial controls',
      'Compliance-ready reporting',
      'Multi-market operations (Middle East)',
      'Organization transformation',
    ],
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
    href: '/connect',
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
