import { lazy } from 'react'

// The dashboard's sections. This list drives both the sidebar and the routes, so a
// new section is one entry here plus its page component.

const Home = lazy(() => import('./pages/Home'))
const ResultsSection = lazy(() => import('./sections/ResultsSection'))
const PagesSection = lazy(() => import('./sections/PagesSection'))
const MediaSection = lazy(() => import('./sections/MediaSection'))
const ServicesSection = lazy(() => import('./sections/ServicesSection'))
const FaqsSection = lazy(() => import('./sections/FaqsSection'))
const ChangelogSection = lazy(() => import('./sections/ChangelogSection'))
const SettingsSection = lazy(() => import('./sections/SettingsSection'))

export const SECTIONS = [
  { id: 'home', path: '', label: 'Home', icon: 'home', element: Home },
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
    id: 'changelog',
    path: 'changelog',
    label: 'Change log',
    icon: 'spark',
    group: 'Site',
    element: ChangelogSection,
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
