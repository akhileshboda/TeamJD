import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import RouteLoading from './components/RouteLoading'
import About from './pages/About'
import { preloadContent } from './hooks/useContent'
import { fontsReady } from './utils/fontsReady'

// A page, the content it shows and the site font arrive together, so the page
// renders complete on its first paint instead of swapping a placeholder for the
// real layout (which made service pages jump while they loaded) or rewrapping
// headings when the font lands. Only the first visit waits on the font.
function lazyPage(load, ...collections) {
  return lazy(() => Promise.all([load(), preloadContent(...collections), fontsReady()]).then(([module]) => module))
}

const Home = lazyPage(() => import('./pages/Home'), 'services', 'faqs', 'results')
const Services = lazyPage(() => import('./pages/Services'), 'services')
const ServiceDetailPage = lazyPage(() => import('./pages/ServiceDetailPage'), 'services')
const Results = lazyPage(() => import('./pages/Results'), 'results')
const Contact = lazyPage(() => import('./pages/Contact'), 'settings')
const Privacy = lazyPage(() => import('./pages/Privacy'), 'settings')
const NotFound = lazyPage(() => import('./pages/NotFound'), 'settings')
const AdminApp = lazy(() => import('./admin/AdminApp'))

export default function App() {
  return (
    <Routes>
      {/* Jake's dashboard is a tool, not a site page: no site nav, footer or funnels. */}
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<RouteLoading />}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:slug" element={<ServiceDetailPage />} />
              <Route path="/results" element={<Results />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  )
}
