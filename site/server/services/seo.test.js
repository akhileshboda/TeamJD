const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AI_CRAWLERS,
  applyRouteToShell,
  buildLlmsTxt,
  buildRobotsTxt,
  resolveRoute
} = require('./seo');

const baseUrl = 'https://team-jd.com.au';
const services = [
  {
    slug: 'personal-training',
    name: 'Personal Training',
    short_description: 'Face-to-face coaching in Adelaide.',
    description: 'Long copy.',
    facts: [{ label: 'Location', value: 'Form First Studio, Thebarton', url: 'https://maps.example/x' }],
    pricing: {
      mode: 'priced',
      tiers: [
        { label: 'Solo sessions', price: '$85', unit: 'per session', description: 'One to one.' },
        { label: 'Joint sessions', price: '$75', unit: 'per person, per session', description: 'With a partner.' }
      ]
    },
    who_its_for: ['You want in-person coaching'],
    includes: [{ title: 'Form coaching', description: 'Cues and corrections.' }]
  },
  {
    slug: 'online-coaching',
    name: 'Online Coaching',
    short_description: 'Coaching anywhere.',
    pricing: { mode: 'consultation', tiers: [], note: null }
  }
];
const faqs = [{ id: 1, question: 'How do I start?', answer: 'Send an enquiry.' }];
const shell = [
  '<!DOCTYPE html><html><head>',
  '<meta charset="UTF-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '<title>Old title</title>',
  '<meta name="description" content="old">',
  '<link rel="canonical" href="https://team-jd.com.au/">',
  '<meta property="og:title" content="old">',
  '<meta name="twitter:card" content="summary_large_image">',
  '</head><body><div id="root"></div></body></html>'
].join('\n');

const resolve = (pathname, extra = {}) => resolveRoute({ pathname, baseUrl, services, faqs, ...extra });
const count = (text, needle) => text.split(needle).length - 1;

test('page routes use the built-in listing, then Settings overrides', () => {
  assert.equal(resolve('/').fullTitle, 'Team JD | Jake Dedert Fitness Coaching');
  assert.equal(resolve('/about').fullTitle, 'About Jake Dedert | Team JD');
  const settings = { seo: { about: { title: 'Meet Jake', description: 'Coach.' } } };
  const about = resolve('/about/', { settings });
  assert.equal(about.fullTitle, 'Meet Jake | Team JD');
  assert.equal(about.description, 'Coach.');
  assert.equal(about.canonical, `${baseUrl}/about`);
});

test('a known service gets its own title, canonical and Service markup with AUD prices', () => {
  const route = resolve('/services/personal-training');
  assert.equal(route.status, 200);
  assert.equal(route.fullTitle, 'Personal Training | Team JD');
  assert.equal(route.canonical, `${baseUrl}/services/personal-training`);
  const service = route.jsonld['@graph'].find((node) => node['@type'] === 'Service');
  assert.equal(service.offers.length, 2);
  assert.deepEqual([service.offers[0].price, service.offers[0].priceCurrency], ['85', 'AUD']);
  assert.equal(service.availableAtOrFrom.name, 'Form First Studio, Thebarton');
});

test('a consultation-priced service publishes no offers', () => {
  const service = resolve('/services/online-coaching').jsonld['@graph'].find((node) => node['@type'] === 'Service');
  assert.equal(service.offers, undefined);
});

test('an unknown service slug is a 404 and noindex', () => {
  const route = resolve('/services/does-not-exist');
  assert.equal(route.status, 404);
  assert.match(route.robots, /^noindex/);
  assert.equal(route.jsonld, null);
});

test('paths that are not site pages resolve to null', () => {
  assert.equal(resolve('/nope'), null);
  assert.equal(resolve('/services/a/b'), null);
});

test('the dashboard is never indexable', () => {
  const route = resolve('/admin/settings');
  assert.match(route.robots, /^noindex/);
  assert.equal(route.jsonld, null);
});

test('only the home page carries FAQ markup, and every page carries the organisation', () => {
  const types = (path) => resolve(path).jsonld['@graph'].map((node) => [].concat(node['@type']).join('+'));
  assert.ok(types('/').includes('FAQPage'));
  assert.ok(!types('/about').includes('FAQPage'));
  for (const path of ['/', '/about', '/services/personal-training']) {
    assert.ok(types(path).some((type) => type.includes('ProfessionalService')), path);
    assert.ok(types(path).includes('Person'), path);
  }
});

test('staging is noindex and locked whatever the page', () => {
  const route = resolve('/about', { staging: true });
  assert.equal(route.robots, 'noindex, nofollow');
  assert.equal(route.robotsLocked, true);
  assert.match(applyRouteToShell(shell, route, { baseUrl, imageUrl: null }), /name="robots" content="noindex, nofollow" data-locked="true"/);
});

test('the shell is rewritten once per tag, with JSON-LD that cannot close its script', () => {
  const hostile = [{ ...services[1], name: 'Evil </script><b>', slug: 'evil' }];
  const route = resolveRoute({ pathname: '/services/evil', baseUrl, services: hostile, faqs: [] });
  const html = applyRouteToShell(shell, route, { baseUrl, imageUrl: 'https://cdn.example/hero.jpg' });
  assert.equal(count(html, '<title>'), 1);
  assert.equal(count(html, 'rel="canonical"'), 1);
  assert.equal(count(html, 'property="og:title"'), 1);
  assert.equal(count(html, 'name="twitter:card"'), 1);
  assert.equal(count(html, 'application/ld+json'), 1);
  assert.equal(count(html, '</script>'), 1);
  assert.ok(!html.includes('Old title'));
  assert.ok(!html.includes('Evil </script>'));
  assert.match(html, /og:image" content="https:\/\/cdn\.example\/hero\.jpg"/);
  assert.match(html, /<noscript data-seo-summary>/);
  assert.ok(html.includes('Evil &lt;/script&gt;&lt;b&gt;'));
  JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
});

test('the no-script summary of a service lists its pricing and inclusions', () => {
  const html = applyRouteToShell(shell, resolve('/services/personal-training'), { baseUrl, imageUrl: null });
  assert.match(html, /Solo sessions: \$85 per session/);
  assert.match(html, /Form coaching: Cues and corrections\./);
});

test('robots.txt: production opens the AI crawlers and lists the sitemap, staging does neither', () => {
  const production = buildRobotsTxt({ baseUrl });
  for (const agent of AI_CRAWLERS) assert.ok(production.includes(`User-agent: ${agent}\n`), agent);
  assert.match(production, /Disallow: \/admin\n/);
  assert.match(production, /Sitemap: https:\/\/team-jd\.com\.au\/sitemap\.xml/);
  assert.ok(!/Disallow: \/api\/\s/.test(production), 'the site and Google need /api/ to render');

  const staging = buildRobotsTxt({ baseUrl: 'https://jake-preview.team-jd.com.au', staging: true });
  assert.ok(!staging.includes('Sitemap:'));
  assert.ok(!staging.includes('GPTBot'));
  assert.ok(!/^Disallow: \/\s*$/m.test(staging), 'crawlers must reach pages to see the noindex header');
});

test('llms.txt summarises services with prices and links; the full file adds details and FAQs', () => {
  const short = buildLlmsTxt({ baseUrl, services, faqs });
  assert.match(short, /^# Team JD\n\n> /);
  assert.match(short, /\[Personal Training\]\(https:\/\/team-jd\.com\.au\/services\/personal-training\)/);
  assert.match(short, /Solo sessions: \$85 per session/);
  assert.match(short, /Online Coaching.*Priced after a consultation/);
  assert.ok(!short.includes('Long copy.'));
  assert.ok(!short.includes('..'), 'a tier description ending in a full stop must not double it');

  const full = buildLlmsTxt({ baseUrl, services, faqs, full: true });
  assert.match(full, /Long copy\./);
  assert.match(full, /### How do I start\?\n\nSend an enquiry\./);
});
