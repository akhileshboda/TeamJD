import Nav from './Nav'
import Footer from './Footer'
import ScrollToTop from './ScrollToTop'

export default function Layout({ children }) {
  return (
    <>
      <ScrollToTop />
      <Nav />
      <main>{children}</main>
      <Footer />
    </>
  )
}
