// Search (SEO) and AI-answer (GEO) output, built on the server so crawlers that
// do not run JavaScript still see the right page: per-route head tags, JSON-LD,
// a plain-text summary in <noscript>, /robots.txt and /llms.txt.
//
// Everything comes from the live content store (services, FAQs, contact
// settings and the dashboard's search listings), never from copy kept here, so a
// price or service Jake edits in the dashboard reaches crawlers on the next load.

const SITE_NAME = 'Team JD';
const DEFAULT_TITLE = 'Team JD | Jake Dedert Fitness Coaching';
const DEFAULT_HOME_DESCRIPTION = 'Jake Dedert is a Pro Physique bodybuilder and coach in Adelaide offering competition preparation, online coaching, personal training and posing.';
const LOGO_PATH = '/assets/branding/team-jd-logo.png';

// Mirrors client/src/content/siteDefaults.js (PAGE_META). A client test keeps the
// two identical.
const PAGE_META = {
  home: { title: '', description: DEFAULT_HOME_DESCRIPTION },
  about: {
    title: 'About Jake Dedert',
    description: 'Pro Physique competitor, competition prep coach and personal trainer. One coaching standard, built around the person doing the work.'
  },
  services: {
    title: 'Coaching Services',
    description: 'Competition preparation, online coaching, personal training and posing with Jake Dedert, in Adelaide or online from anywhere.'
  },
  results: {
    title: 'Client Results',
    description: 'Explore genuine Team JD client outcomes across competition prep, posing and coaching.'
  },
  contact: {
    title: 'Contact Jake',
    description: 'Book a consultation or send Jake Dedert a message about coaching, competition prep or posing.'
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How Team JD collects, uses and protects your personal information.'
  }
};

const PAGE_PATHS = {
  home: '/',
  about: '/about',
  services: '/services',
  results: '/results',
  contact: '/contact',
  privacy: '/privacy'
};
const PATH_PAGES = Object.fromEntries(Object.entries(PAGE_PATHS).map(([page, path]) => [path, page]));

const PAGE_SCHEMA_TYPES = {
  about: 'AboutPage',
  services: 'CollectionPage',
  results: 'CollectionPage',
  contact: 'ContactPage'
};

// Search-and-answer crawlers and AI training opt-outs share one list so Jake's
// choice is in a single place. Delete a name here to turn that crawler away.
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended'
];

const DEFAULT_CONTACT = Object.freeze({
  email: 'jake@team-jd.com.au',
  instagramUrl: 'https://www.instagram.com/jake_dedert_teamjd_coaching/',
  facebookUrl: 'https://www.facebook.com/p/Jake-Dedert-Team-JD-Coaching-100063678694779/'
});

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
));

// JSON inside a <script> block must not be able to close it.
const safeJson = (value) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const trimSlash = (value) => String(value || '').replace(/\/+$/, '');

function normalizePath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(String(pathname || '/').split('?')[0]);
  } catch (_error) {
    return null;
  }
  if (!decoded.startsWith('/')) decoded = `/${decoded}`;
  return decoded.length > 1 ? decoded.replace(/\/+$/, '') : '/';
}

function priceNumber(price) {
  const match = String(price ?? '').match(/(\d[\d,]*(?:\.\d+)?)/);
  return match ? match[1].replace(/,/g, '') : null;
}

function contactOf(settings) {
  const contact = { ...DEFAULT_CONTACT, ...(settings?.contact || {}) };
  return {
    email: contact.email || DEFAULT_CONTACT.email,
    sameAs: [contact.instagramUrl, contact.facebookUrl].filter(Boolean)
  };
}

function listingFor(page, settings) {
  const override = settings?.seo?.[page] || {};
  const builtIn = PAGE_META[page];
  return {
    title: override.title || builtIn.title,
    description: override.description || builtIn.description
  };
}

// ---- JSON-LD ---------------------------------------------------------------

function organizationGraph(baseUrl, settings) {
  const { email, sameAs } = contactOf(settings);
  const org = `${baseUrl}/#organization`;
  const person = `${baseUrl}/#jake`;
  return [
    {
      '@type': 'WebSite',
      '@id': `${baseUrl}/#website`,
      url: `${baseUrl}/`,
      name: SITE_NAME,
      inLanguage: 'en-AU',
      publisher: { '@id': org }
    },
    {
      '@type': ['ProfessionalService', 'Organization'],
      '@id': org,
      name: SITE_NAME,
      alternateName: 'Team JD Coaching',
      url: `${baseUrl}/`,
      logo: `${baseUrl}${LOGO_PATH}`,
      image: `${baseUrl}${LOGO_PATH}`,
      description: DEFAULT_HOME_DESCRIPTION,
      email,
      sameAs,
      founder: { '@id': person },
      employee: { '@id': person },
      areaServed: [
        { '@type': 'City', name: 'Adelaide', containedInPlace: { '@type': 'AdministrativeArea', name: 'South Australia' } },
        { '@type': 'Country', name: 'Australia' }
      ],
      knowsAbout: ['Competition preparation', 'Online coaching', 'Personal training', 'Bodybuilding posing', 'Pro Physique']
    },
    {
      '@type': 'Person',
      '@id': person,
      name: 'Jake Dedert',
      jobTitle: 'Pro Physique competitor and fitness coach',
      url: `${baseUrl}/about`,
      worksFor: { '@id': org },
      sameAs
    }
  ];
}

function serviceNode(service, baseUrl) {
  const url = `${baseUrl}/services/${service.slug}`;
  const node = {
    '@type': 'Service',
    '@id': `${url}#service`,
    name: service.name,
    serviceType: service.name,
    url,
    description: service.short_description || service.tagline || undefined,
    provider: { '@id': `${baseUrl}/#organization` },
    areaServed: { '@type': 'Country', name: 'Australia' }
  };
  const location = (service.facts || []).find((fact) => /^location$/i.test(fact.label || ''));
  if (location?.value) {
    node.availableAtOrFrom = { '@type': 'Place', name: location.value, ...(location.url ? { hasMap: location.url } : {}) };
  }
  const tiers = service.pricing?.mode === 'priced' ? service.pricing.tiers || [] : [];
  const offers = tiers
    .map((tier) => ({ tier, price: priceNumber(tier.price) }))
    .filter(({ price }) => price)
    .map(({ tier, price }) => ({
      '@type': 'Offer',
      name: tier.label,
      price,
      priceCurrency: 'AUD',
      description: [tier.unit, tier.description].filter(Boolean).join('. ') || undefined,
      url
    }));
  if (offers.length) node.offers = offers.length === 1 ? offers[0] : offers;
  return node;
}

function breadcrumb(baseUrl, trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, path], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: `${baseUrl}${path}`
    }))
  };
}

function buildGraph({ route, baseUrl, settings, services, faqs }) {
  const graph = [...organizationGraph(baseUrl, settings)];
  const url = `${baseUrl}${route.path === '/' ? '/' : route.path}`;

  if (route.kind === 'page') {
    const type = PAGE_SCHEMA_TYPES[route.page] || 'WebPage';
    graph.push({
      '@type': type,
      '@id': `${url}#webpage`,
      url,
      name: route.fullTitle,
      description: route.description,
      inLanguage: 'en-AU',
      isPartOf: { '@id': `${baseUrl}/#website` },
      about: { '@id': `${baseUrl}/#organization` }
    });
    if (route.page !== 'home') {
      graph.push(breadcrumb(baseUrl, [['Home', '/'], [listingFor(route.page, settings).title || route.page, route.path]]));
    }
    if (route.page === 'services') {
      graph.push({
        '@type': 'ItemList',
        itemListElement: services.map((service, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `${baseUrl}/services/${service.slug}`,
          name: service.name
        }))
      });
    }
    if (route.page === 'home' && faqs.length) {
      // The home page shows these questions, which is what FAQ markup requires.
      graph.push({
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer }
        }))
      });
    }
  }

  if (route.kind === 'service') {
    graph.push({
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: route.fullTitle,
      description: route.description,
      inLanguage: 'en-AU',
      isPartOf: { '@id': `${baseUrl}/#website` },
      mainEntity: { '@id': `${url}#service` }
    });
    graph.push(serviceNode(route.service, baseUrl));
    graph.push(breadcrumb(baseUrl, [['Home', '/'], ['Services', '/services'], [route.service.name, route.path]]));
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

// ---- Plain-text summary for crawlers that do not run scripts ----------------

function pricingLines(service) {
  if (service.pricing?.mode !== 'priced') return [];
  return (service.pricing.tiers || []).map((tier) => (
    `${tier.label}: ${tier.price}${tier.unit ? ` ${tier.unit}` : ''}${tier.description ? `. ${tier.description.replace(/[.\s]+$/, '')}` : ''}`
  ));
}

function renderSummary({ route, services, faqs, settings }) {
  const { email } = contactOf(settings);
  const nav = Object.entries(PAGE_PATHS)
    .map(([page, path]) => `<li><a href="${path}">${escapeHtml(page === 'home' ? 'Home' : listingFor(page, settings).title || page)}</a></li>`)
    .join('');
  const list = (items) => `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
  const serviceLinks = () => list(services.map((service) => (
    `<a href="/services/${escapeHtml(service.slug)}">${escapeHtml(service.name)}</a>: ${escapeHtml(service.short_description || '')}`
  )));

  let body = '';
  if (route.kind === 'service') {
    const { service } = route;
    const prices = pricingLines(service);
    body += `<h1>${escapeHtml(service.name)}</h1><p>${escapeHtml(service.short_description || '')}</p>`;
    if (service.description) body += `<p>${escapeHtml(service.description)}</p>`;
    if (service.who_its_for?.length) body += `<h2>Who it is for</h2>${list(service.who_its_for.map(escapeHtml))}`;
    if (service.includes?.length) {
      body += `<h2>What is included</h2>${list(service.includes.map((item) => `${escapeHtml(item.title)}: ${escapeHtml(item.description || '')}`))}`;
    }
    if (service.facts?.length) body += `<h2>At a glance</h2>${list(service.facts.map((fact) => `${escapeHtml(fact.label)}: ${escapeHtml(fact.value)}`))}`;
    if (prices.length) body += `<h2>Pricing</h2>${list(prices.map(escapeHtml))}`;
    else body += '<h2>Pricing</h2><p>Priced after a consultation with Jake.</p>';
  } else if (route.kind === 'page') {
    body += `<h1>${escapeHtml(route.page === 'home' ? 'Team JD: Jake Dedert Fitness Coaching' : route.title)}</h1><p>${escapeHtml(route.description)}</p>`;
    if (route.page === 'home' || route.page === 'services') body += `<h2>Services</h2>${serviceLinks()}`;
    if (route.page === 'home' && faqs.length) {
      body += `<h2>Frequently asked questions</h2>${faqs.map((faq) => `<h3>${escapeHtml(faq.question)}</h3><p>${escapeHtml(faq.answer)}</p>`).join('')}`;
    }
    if (route.page === 'contact') body += `<p>Email <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>.</p>`;
  } else {
    body += `<h1>${escapeHtml(route.title)}</h1>`;
  }

  return `<noscript data-seo-summary><header><a href="/">Team JD</a><nav><ul>${nav}</ul></nav></header><main>${body}</main></noscript>`;
}

// ---- Route resolution --------------------------------------------------------

// What a crawler should be told about `pathname`: status, title, description,
// canonical, indexability and structured data. Returns null for paths that are
// not site pages (the caller falls through to its own 404).
function resolveRoute({ pathname, baseUrl, settings = null, services = [], faqs = [], staging = false }) {
  const base = trimSlash(baseUrl);
  const path = normalizePath(pathname);
  if (!path) return null;

  let route;
  if (/^\/admin(\/|$)/i.test(path)) {
    route = { kind: 'admin', status: 200, path, title: 'Dashboard', description: '', noindex: true };
  } else if (PATH_PAGES[path]) {
    const page = PATH_PAGES[path];
    const listing = listingFor(page, settings);
    route = { kind: 'page', status: 200, page, path, title: listing.title, description: listing.description, noindex: false };
  } else if (/^\/services\/[^/]+$/.test(path)) {
    const slug = path.split('/')[2];
    const service = services.find((candidate) => candidate.slug === slug);
    route = service
      ? { kind: 'service', status: 200, path, service, title: service.name, description: service.short_description || service.tagline || '', noindex: false }
      : { kind: 'missing', status: 404, path, title: 'Page Not Found', description: '', noindex: true };
  } else {
    return null;
  }

  route.fullTitle = route.kind === 'page' && !route.title ? DEFAULT_TITLE : `${route.title} | ${SITE_NAME}`;
  route.canonical = `${base}${route.path === '/' ? '/' : route.path}`;
  // Staging is never for search engines, whatever the page says.
  route.robots = staging || route.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
  route.robotsLocked = staging;
  route.jsonld = route.kind === 'page' || route.kind === 'service'
    ? buildGraph({ route, baseUrl: base, settings, services, faqs })
    : null;
  route.summary = route.kind === 'admin' ? '' : renderSummary({ route, services, faqs, settings });
  return route;
}

// ---- Shell injection ----------------------------------------------------------

const HEAD_TAGS_TO_REPLACE = [
  /<title>[\s\S]*?<\/title>\s*/i,
  /<meta\s+name="description"[^>]*>\s*/gi,
  /<meta\s+name="robots"[^>]*>\s*/gi,
  /<link\s+rel="canonical"[^>]*>\s*/gi,
  /<meta\s+property="og:[^"]*"[^>]*>\s*/gi,
  /<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi
];

function renderHeadTags(route, { baseUrl, imageUrl }) {
  const base = trimSlash(baseUrl);
  const tags = [
    `<title>${escapeHtml(route.fullTitle)}</title>`,
    route.description ? `<meta name="description" content="${escapeHtml(route.description)}">` : '',
    `<meta name="robots" content="${route.robots}"${route.robotsLocked ? ' data-locked="true"' : ''}>`,
    `<link rel="canonical" href="${escapeHtml(route.canonical)}">`,
    `<meta name="teamjd:site-url" content="${escapeHtml(base)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    '<meta property="og:locale" content="en_AU">',
    `<meta property="og:title" content="${escapeHtml(route.fullTitle)}">`,
    route.description ? `<meta property="og:description" content="${escapeHtml(route.description)}">` : '',
    `<meta property="og:url" content="${escapeHtml(route.canonical)}">`,
    imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : '',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(route.fullTitle)}">`,
    route.description ? `<meta name="twitter:description" content="${escapeHtml(route.description)}">` : '',
    imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}">` : '',
    route.jsonld ? `<script type="application/ld+json">${safeJson(route.jsonld)}</script>` : ''
  ];
  return tags.filter(Boolean).join('\n  ');
}

// Rewrites the built index.html for `route`. The built file's own title, meta and
// share tags are removed first so nothing appears twice.
function applyRouteToShell(html, route, options) {
  let out = html;
  for (const pattern of HEAD_TAGS_TO_REPLACE) out = out.replace(pattern, '');
  const headTags = renderHeadTags(route, options);
  out = /<meta\s+name="viewport"[^>]*>/i.test(out)
    ? out.replace(/(<meta\s+name="viewport"[^>]*>)/i, `$1\n  ${headTags}`)
    : out.replace(/<\/head>/i, `  ${headTags}\n</head>`);
  if (route.summary) out = out.replace(/(<div\s+id="root"[^>]*>\s*<\/div>)/i, `$1\n  ${route.summary}`);
  return out;
}

// ---- robots.txt, llms.txt -------------------------------------------------------

function buildRobotsTxt({ baseUrl, staging = false }) {
  if (staging) {
    // Left crawlable on purpose: crawlers must be able to fetch pages to see the
    // noindex header every staging response carries.
    return 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\n';
  }
  const agents = ['*', ...AI_CRAWLERS].map((agent) => `User-agent: ${agent}`).join('\n');
  // /api/ stays open: the site loads its content and images from it, and Google
  // needs both to render a page.
  return `${agents}\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\n\nSitemap: ${trimSlash(baseUrl)}/sitemap.xml\n`;
}

function buildLlmsTxt({ baseUrl, settings = null, services = [], faqs = [], full = false }) {
  const base = trimSlash(baseUrl);
  const { email, sameAs } = contactOf(settings);
  const lines = [
    `# ${SITE_NAME}`,
    '',
    `> ${DEFAULT_HOME_DESCRIPTION} Based in Adelaide, South Australia; online coaching is available worldwide.`,
    '',
    '## Services',
    ''
  ];
  for (const service of services) {
    const prices = pricingLines(service);
    lines.push(`- [${service.name}](${base}/services/${service.slug}): ${service.short_description || service.tagline || ''}${prices.length ? ` Pricing: ${prices.join('; ')}.` : ' Priced after a consultation.'}`);
  }
  lines.push('', '## Pages', '');
  for (const [page, path] of Object.entries(PAGE_PATHS)) {
    lines.push(`- [${page === 'home' ? 'Home' : listingFor(page, settings).title}](${base}${path === '/' ? '/' : path}): ${listingFor(page, settings).description}`);
  }
  lines.push('', '## Contact', '', `- Email: ${email}`, ...sameAs.map((url) => `- ${url}`));

  if (full) {
    lines.push('', '## Service details');
    for (const service of services) {
      lines.push('', `### ${service.name}`, '', service.description || service.short_description || '');
      if (service.who_its_for?.length) lines.push('', 'Who it is for:', ...service.who_its_for.map((item) => `- ${item}`));
      if (service.includes?.length) lines.push('', 'Included:', ...service.includes.map((item) => `- ${item.title}: ${item.description || ''}`));
      if (service.facts?.length) lines.push('', 'At a glance:', ...service.facts.map((fact) => `- ${fact.label}: ${fact.value}`));
      const prices = pricingLines(service);
      lines.push('', prices.length ? `Pricing:\n${prices.map((price) => `- ${price}`).join('\n')}` : 'Pricing: set after a consultation.');
    }
  }
  if (faqs.length) {
    lines.push('', '## Frequently asked questions');
    for (const faq of faqs) lines.push('', `### ${faq.question}`, '', faq.answer);
  }
  return `${lines.join('\n')}\n`;
}

module.exports = {
  PAGE_META,
  AI_CRAWLERS,
  applyRouteToShell,
  buildLlmsTxt,
  buildRobotsTxt,
  escapeHtml,
  resolveRoute
};
