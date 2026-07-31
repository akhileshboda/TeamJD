import Nav from './Nav'
import Footer from './Footer'
import ScrollToTop from './ScrollToTop'
import ServiceFinder from './ServiceFinder'
import { useJSON } from '../hooks/useJSON'

export default function Layout({ children }) {
  const { data: services, loading, error } = useJSON('/content/services.json')

  return (
    <>
      <ScrollToTop />
      <Nav />
      <main>{children}</main>
      <Footer />
      <ServiceFinder services={services || []} loading={loading} error={error} />
    </>
  )
}
