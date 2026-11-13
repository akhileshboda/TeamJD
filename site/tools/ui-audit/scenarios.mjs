// What the layout audit visits. Each scenario is a route plus optional setup
// (network mocks, clicks) and the selector that marks "rendered".
//
// `discover` expands one entry into several, by collecting links from a page
// (e.g. every editor reachable from a list).

const ADMIN_SCOPE = '.jd-admin-main'
const PUBLIC_SCOPE = 'main, #root'

const zeroStats = async (route) => {
  const response = await route.fetch()
  const body = await response.json()
  const zero = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? 0 : v]))
  body.current = zero(body.current)
  body.previous = zero(body.previous)
  body.daily = (body.daily || []).map(zero)
  for (const key of Object.keys(body)) if (Array.isArray(body[key]) && key !== 'daily') body[key] = []
  await route.fulfill({ response, json: body })
}

export const ADMIN = [
  { id: 'admin-home', path: '/admin', waitFor: '.jd-scoreboard', scope: ADMIN_SCOPE },
  { id: 'admin-home-7d', path: '/admin?range=7d', waitFor: '.jd-scoreboard', scope: ADMIN_SCOPE, viewports: ['desktop'] },
  {
    id: 'admin-home-empty', path: '/admin', waitFor: '.jd-scoreboard', scope: ADMIN_SCOPE,
    setup: (page) => page.route('**/api/admin/stats**', zeroStats),
  },
  {
    id: 'admin-home-loading', path: '/admin', waitFor: '.jd-skeleton', scope: ADMIN_SCOPE, noIdle: true,
    setup: (page) => page.route('**/api/admin/stats**', () => {}),
  },
  {
    id: 'admin-home-error', path: '/admin', waitFor: '.jd-admin-error', scope: ADMIN_SCOPE,
    setup: (page) => page.route('**/api/admin/stats**', (route) => route.fulfill({ status: 500, json: { error: 'Could not load visit numbers. Try again in a minute.' } })),
  },
  { id: 'admin-pages', path: '/admin/pages', scope: ADMIN_SCOPE },
  { id: 'admin-pages-editor', discover: { from: '/admin/pages', selector: '.jd-admin-main a[href^="/admin/pages/"]', limit: 2 }, scope: ADMIN_SCOPE },
  { id: 'admin-results', path: '/admin/results', scope: ADMIN_SCOPE },
  { id: 'admin-results-editor', path: '/admin/results/1', scope: ADMIN_SCOPE },
  { id: 'admin-services', path: '/admin/services', scope: ADMIN_SCOPE },
  { id: 'admin-services-editor', path: '/admin/services/competition-prep', scope: ADMIN_SCOPE },
  { id: 'admin-faqs', path: '/admin/faqs', scope: ADMIN_SCOPE },
  { id: 'admin-faqs-editor', path: '/admin/faqs/1', scope: ADMIN_SCOPE },
  { id: 'admin-media', path: '/admin/media', scope: ADMIN_SCOPE },
  { id: 'admin-changelog', path: '/admin/changelog', scope: ADMIN_SCOPE },
  { id: 'admin-settings', discover: { from: '/admin/settings', selector: 'a.jd-settings-link', limit: 8, includeFrom: true }, scope: ADMIN_SCOPE },
  { id: 'admin-404', path: '/admin/this-does-not-exist', scope: ADMIN_SCOPE },
  // Interactive states (clicked into after load).
  {
    id: 'admin-drawer-open', path: '/admin', waitFor: '.jd-scoreboard', scope: 'body', viewports: ['phone', 'tablet'],
    after: (page) => page.getByRole('button', { name: 'Open menu' }).click(),
  },
  {
    id: 'admin-sidebar-collapsed', path: '/admin', waitFor: '.jd-scoreboard', scope: ADMIN_SCOPE, viewports: ['wide', 'xl'],
    after: (page) => page.getByRole('button', { name: 'Collapse menu' }).click(),
  },
  {
    id: 'admin-results-selected', path: '/admin/results', scope: ADMIN_SCOPE, viewports: ['phone', 'tablet', 'wide'],
    after: async (page) => {
      await page.getByRole('checkbox', { name: /^Select (?!all)/ }).nth(0).check()
      await page.getByRole('checkbox', { name: /^Select (?!all)/ }).nth(1).check()
    },
  },
  {
    id: 'admin-faqs-reorder', path: '/admin/faqs', scope: ADMIN_SCOPE, viewports: ['phone', 'tablet', 'wide'],
    after: (page) => page.getByRole('button', { name: 'Reorder' }).click(),
  },
  {
    id: 'admin-media-picker', path: '/admin/pages/about', scope: 'body', viewports: ['phone', 'tablet', 'wide'],
    after: (page) => page.getByRole('button', { name: /Choose (photo|video)/ }).first().click(),
  },
]

export const PUBLIC = [
  { id: 'home', path: '/', scope: PUBLIC_SCOPE },
  { id: 'about', path: '/about', scope: PUBLIC_SCOPE },
  { id: 'services', path: '/services', scope: PUBLIC_SCOPE },
  { id: 'service-detail', discover: { from: '/services', selector: 'a[href^="/services/"]', limit: 4 }, scope: PUBLIC_SCOPE },
  { id: 'results', path: '/results', scope: PUBLIC_SCOPE },
  { id: 'contact', path: '/contact', scope: PUBLIC_SCOPE },
  { id: 'privacy', path: '/privacy', scope: PUBLIC_SCOPE },
  { id: 'not-found', path: '/this-does-not-exist', scope: PUBLIC_SCOPE },
  { id: 'static-404', path: '/404.html', scope: 'body' },
  { id: 'static-500', path: '/500.html', scope: 'body' },
  { id: 'static-503', path: '/503.html', scope: 'body' },
  { id: 'static-offline', path: '/offline.html', scope: 'body' },
]

export const VIEWPORTS = {
  phone: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1024, height: 768 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1440, height: 900 },
  xl: { width: 1920, height: 1080 },
}

// globals.css :root --space-* and --radius-* in px (1rem = 16px).
export const SPACING_SCALE = [1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64, 80, 96, 128]
export const RADIUS_SCALE = [2, 4, 6, 8, 12, 16, 24]
