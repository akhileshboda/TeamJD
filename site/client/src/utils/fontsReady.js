// Resolves once the site font (Manrope) has loaded, or after `capMs`, whichever is
// first. Pages wait for it before they first draw (see App.jsx) so headings don't
// rewrap when the font swaps in. The cap keeps a slow font server from holding a
// page back: past it the page draws with the metric-matched fallback instead.
const WEIGHTS = [400, 500, 700, 800]

let ready = null

// index.html loads Google's font stylesheet without blocking (#site-font-css). The
// font faces only exist once it has arrived, so wait for it before asking for them.
function stylesheetLoaded() {
  const link = document.getElementById('site-font-css')
  if (!link || link.sheet) return Promise.resolve()
  // It loads as a preload first, then fires load again once applied as a stylesheet.
  return new Promise((resolve) => {
    const settle = () => {
      if (!link.sheet) return
      link.removeEventListener('load', settle)
      resolve()
    }
    link.addEventListener('load', settle)
    link.addEventListener('error', resolve, { once: true })
  })
}

export function fontsReady(capMs = 1200) {
  if (typeof document === 'undefined' || !document.fonts?.load) return Promise.resolve()
  if (!ready) {
    ready = stylesheetLoaded()
      .then(() => Promise.all(WEIGHTS.map((weight) => document.fonts.load(`${weight} 1em Manrope`))))
      .catch(() => null)
  }
  return Promise.race([ready, new Promise((resolve) => setTimeout(resolve, capMs))])
}
