// /sitemap.xml, built from the live services so a renamed or reordered service
// never leaves the sitemap behind. Same pages and priorities as the old static file.

const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/about', changefreq: 'monthly', priority: '0.8' },
  { path: '/services', changefreq: 'monthly', priority: '0.9' },
  { path: '/results', changefreq: 'weekly', priority: '0.8' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' }
];

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]));
}

function buildSitemap({ baseUrl, services, lastmod }) {
  const origin = String(baseUrl || 'https://team-jd.com.au').replace(/\/+$/, '');
  const pages = [
    ...STATIC_PAGES.slice(0, 3),
    ...services.map((service) => ({ path: `/services/${service.slug}`, changefreq: 'monthly', priority: '0.8' })),
    ...STATIC_PAGES.slice(3)
  ];
  const urls = pages.map((page) => [
    '  <url>',
    `    <loc>${escapeXml(`${origin}${page.path}`)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${page.changefreq}</changefreq>`,
    `    <priority>${page.priority}</priority>`,
    '  </url>'
  ].join('\n'));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

module.exports = { buildSitemap };
