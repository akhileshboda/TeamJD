import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import About from './pages/About'

const Home = lazy(() => import('./pages/Home'))
const Services = lazy(() => import('./pages/Services'))
const ServiceDetailPage = lazy(() => import('./pages/ServiceDetailPage'))
const Results = lazy(() => import('./pages/Results'))
const Contact = lazy(() => import('./pages/Contact'))
const Privacy = lazy(() => import('./pages/Privacy'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Admin = lazy(() => import('./pages/Admin'))

export default function App() {
  const loading = <div className="route-loading" role="status">Loading page&hellip;</div>

  return (
    <Routes>
      {/* The media manager is Jake's tool, not a site page: no site nav, footer or funnels. */}
      <Route
        path="/admin"
        element={
          <Suspense fallback={loading}>
            <Admin />
          </Suspense>
        }
      />
      <Route
        path="*"
        element={
          <Layout>
            <Suspense fallback={loading}>
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
            </Suspense>
          </Layout>
        }
      />
    </Routes>
  )
}
