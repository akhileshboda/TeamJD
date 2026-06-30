import Nav from './Nav'
import Footer from './Footer'
import ScrollToTop from './ScrollToTop'
import SiteBackground from './SiteBackground'

export default function Layout({ children }) {
  return (
    <div className="site-wrapper">
      <SiteBackground />
      <ScrollToTop />
      <Nav />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
