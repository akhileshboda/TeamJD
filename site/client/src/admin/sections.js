import { lazy } from 'react'

// The dashboard's sections. This list drives both the sidebar and the routes, so a
// new section is one entry here plus its page component.

const HomeStats = lazy(() => import('./pages/HomeStats'))
const ResultsSection = lazy(() => import('./sections/ResultsSection'))
const TestimonialsSection = lazy(() => import('./sections/TestimonialsSection'))
const PagesSection = lazy(() => import('./sections/PagesSection'))
const MediaSection = lazy(() => import('./sections/MediaSection'))
const ServicesSection = lazy(() => import('./sections/ServicesSection'))
const FaqsSection = lazy(() => import('./sections/FaqsSection'))
const SettingsSection = lazy(() => import('./sections/SettingsSection'))

export const SECTIONS = [
  { id: 'home', path: '', label: 'Home', icon: 'home', element: HomeStats },
  {
    id: 'pages',
    path: 'pages',
    label: 'Pages',
    icon: 'layout',
    element: PagesSection,
  },
  {
    id: 'results',
    path: 'results',
    label: 'Results',
    icon: 'trophy',
    group: 'Content',
    element: ResultsSection,
  },
  {
    id: 'testimonials',
    path: 'testimonials',
    label: 'Testimonials',
    icon: 'quote',
    group: 'Content',
    element: TestimonialsSection,
  },
  {
    id: 'services',
    path: 'services',
    label: 'Services & prices',
    icon: 'tag',
    group: 'Content',
    element: ServicesSection,
  },
  {
    id: 'faqs',
    path: 'faqs',
    label: 'FAQs',
    icon: 'help',
    group: 'Content',
    element: FaqsSection,
  },
  {
    id: 'media',
    path: 'media',
    label: 'Media library',
    icon: 'image',
    group: 'Content',
    element: MediaSection,
  },
  {
    id: 'settings',
    path: 'settings',
    label: 'Settings',
    icon: 'settings',
    group: 'Site',
    element: SettingsSection,
  },
]

export function sectionForPath(pathname) {
  const rest = pathname.replace(/^\/admin\/?/, '').split('/')[0]
  return SECTIONS.find((section) => section.path === rest) || null
}

export function groupedSections() {
  const groups = []
  for (const section of SECTIONS) {
    const name = section.group || null
    const last = groups.at(-1)
    if (last && last.name === name) last.sections.push(section)
    else groups.push({ name, sections: [section] })
  }
  return groups
}
