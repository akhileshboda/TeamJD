import { lazy } from 'react'

// The dashboard's sections. This list drives both the sidebar and the routes, so a
// new section is one entry here plus its page component. Sections without an
// `element` yet show a "coming next" page.

const HomeStats = lazy(() => import('./pages/HomeStats'))
const ResultsSection = lazy(() => import('./sections/ResultsSection'))
const TestimonialsSection = lazy(() => import('./sections/TestimonialsSection'))
const PagesSection = lazy(() => import('./sections/PagesSection'))
const MediaSection = lazy(() => import('./sections/MediaSection'))

export const SECTIONS = [
  { id: 'home', path: '', label: 'Home', icon: 'home', element: HomeStats },
  {
    id: 'pages',
    path: 'pages',
    label: 'Pages',
    icon: 'layout',
    element: PagesSection,
    summary: 'Choose the photos and videos shown on each page of your site.',
  },
  {
    id: 'results',
    path: 'results',
    label: 'Results',
    icon: 'trophy',
    group: 'Content',
    element: ResultsSection,
    summary: 'Add your clients’ results and choose which ones the site shows.',
  },
  {
    id: 'testimonials',
    path: 'testimonials',
    label: 'Testimonials',
    icon: 'quote',
    group: 'Content',
    element: TestimonialsSection,
    summary: 'Collect what clients say about working with you.',
  },
  {
    id: 'services',
    path: 'services',
    label: 'Services & prices',
    icon: 'tag',
    group: 'Content',
    summary: 'Update what each service includes, its prices and its booking link.',
  },
  {
    id: 'faqs',
    path: 'faqs',
    label: 'FAQs',
    icon: 'help',
    group: 'Content',
    summary: 'Answer the questions people ask before they book.',
  },
  {
    id: 'media',
    path: 'media',
    label: 'Media library',
    icon: 'image',
    group: 'Content',
    element: MediaSection,
    summary: 'Every photo and video you have uploaded, and where each one is used.',
  },
  {
    id: 'settings',
    path: 'settings',
    label: 'Settings',
    icon: 'settings',
    group: 'Site',
    summary: 'Contact details, social links, search listings and site controls.',
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
