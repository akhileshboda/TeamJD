import Nav from './Nav'
import Footer from './Footer'
import ScrollToTop from './ScrollToTop'
import PageViewTracker from './PageViewTracker'
import ServiceFinder from './ServiceFinder'
import { useContent } from '../hooks/useContent'
import { FindYourFitSessionProvider } from '../context/FindYourFitSession'

export default function Layout({ children }) {
  const { data: services, loading, error } = useContent('services')

  return (
    <FindYourFitSessionProvider>
      <ScrollToTop />
      <PageViewTracker />
      <Nav />
      <main>{children}</main>
      <Footer />
      <ServiceFinder services={services || []} loading={loading} error={error} />
    </FindYourFitSessionProvider>
  )
}
