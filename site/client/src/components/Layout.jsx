import Nav from './Nav'
import Footer from './Footer'
import ScrollToTop from './ScrollToTop'
import ServiceFinder from './ServiceFinder'
import { useJSON } from '../hooks/useJSON'
import { FindYourFitSessionProvider } from '../context/FindYourFitSession'

export default function Layout({ children }) {
  const { data: services, loading, error } = useJSON('/content/services.json')

  return (
    <FindYourFitSessionProvider>
      <ScrollToTop />
      <Nav />
      <main>{children}</main>
      <Footer />
      <ServiceFinder services={services || []} loading={loading} error={error} />
    </FindYourFitSessionProvider>
  )
}
