// index.html preloads Google's font stylesheet (#site-font-css) so it never blocks
// the first paint. This switches it to a real stylesheet. It runs from the app
// bundle because the Content-Security-Policy blocks inline onload="..." handlers.
// fontsReady() then waits for the sheet before asking for the font faces.
export function applyFontStylesheet(doc = document) {
  const link = doc.getElementById('site-font-css')
  if (link && link.rel !== 'stylesheet') link.rel = 'stylesheet'
}
