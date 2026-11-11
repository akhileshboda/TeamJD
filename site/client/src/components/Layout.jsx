import { Suspense } from 'react'
import Nav from './Nav'
import Footer from './Footer'
import ScrollToTop from './ScrollToTop'
import PageViewTracker from './PageViewTracker'
import ServiceFinder from './ServiceFinder'
import RouteLoading from './RouteLoading'
import { useContent } from '../hooks/useContent'
import { FindYourFitSessionProvider } from '../context/FindYourFitSession'

export default function Layout({ children }) {
  const { data: services, loading, error } = useContent('services')

  return (
    <FindYourFitSessionProvider>
      <ScrollToTop />
      <PageViewTracker />
      <Nav />
      {/* The footer waits with the page, so it never flashes in before the content. */}
      <Suspense fallback={<main><RouteLoading /></main>}>
        <main>{children}</main>
        <Footer />
      </Suspense>
      <ServiceFinder services={services || []} loading={loading} error={error} />
    </FindYourFitSessionProvider>
  )
}
