// Built-in words for each page's search listing, and the contact details the
// site falls back to while Settings load. Jake can override both from the
// dashboard (Settings); server/services/cmsSettings.js seeds the same contact
// details into the content store.

export const PAGE_META = {
  home: {
    title: '',
    description:
      'Jake Dedert is a Pro Physique bodybuilder and coach in Adelaide offering competition preparation, online coaching, personal training and posing.',
  },
  about: {
    title: 'About Jake Dedert',
    description:
      'Pro Physique competitor, competition prep coach and personal trainer. One coaching standard, built around the person doing the work.',
  },
  services: {
    title: 'Coaching Services',
    description:
      'Competition preparation, online coaching, personal training and posing with Jake Dedert, in Adelaide or online from anywhere.',
  },
  results: {
    title: 'Client Results',
    description: 'Explore genuine Team JD client outcomes across competition prep, posing and coaching.',
  },
  contact: {
    title: 'Contact Jake',
    description: 'Book a consultation or send Jake Dedert a message about coaching, competition prep or posing.',
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How Team JD collects, uses and protects your personal information.',
  },
}

export const PAGE_LABELS = {
  home: 'Home',
  about: 'About',
  services: 'Services',
  results: 'Results',
  contact: 'Contact',
  privacy: 'Privacy policy',
}

export const CONTACT_FALLBACK = {
  email: 'jake@team-jd.com.au',
  instagramUrl: 'https://www.instagram.com/jake_dedert_teamjd_coaching/',
  instagramHandle: 'jake_dedert_teamjd_coaching',
  facebookUrl: 'https://www.facebook.com/p/Jake-Dedert-Team-JD-Coaching-100063678694779/',
}
