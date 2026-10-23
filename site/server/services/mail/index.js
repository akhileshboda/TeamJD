const { buildCustomerTemplate, buildInternalTemplate } = require('../enquiryTemplates');
const { createResendProvider, MailProviderError } = require('./resend');

function cleanHeaderValue(value) {
  const result = String(value || '').trim();
  if (!result || /[\r\n]/.test(result)) return null;
  return result;
}

// Where enquiries go: the dashboard setting if Jake has set one, else .env.
function enquiryRecipientOverride() {
  // Lazy: the content store is not needed to send sign-in codes.
  const { getCmsStore } = require('../cmsStore');
  return cleanHeaderValue(getCmsStore().cachedSettings()?.enquiries?.sendTo);
}

// Footer social links: the dashboard's contact settings, else the defaults.
function socialLinks() {
  const { getCmsStore } = require('../cmsStore');
  const { DEFAULT_SETTINGS } = require('../cmsSettings');
  const contact = getCmsStore().cachedSettings()?.contact || DEFAULT_SETTINGS.contact;
  return { instagramUrl: contact.instagramUrl, facebookUrl: contact.facebookUrl };
}

function getMailConfig() {
  const override = enquiryRecipientOverride();
  return {
    provider: cleanHeaderValue(process.env.ENQUIRY_MAIL_PROVIDER),
    apiKey: (process.env.RESEND_API_KEY || '').trim(),
    from: cleanHeaderValue(process.env.ENQUIRY_EMAIL_FROM),
    notificationTo: override || cleanHeaderValue(process.env.ENQUIRY_NOTIFICATION_TO),
    replyTo: override || cleanHeaderValue(process.env.ENQUIRY_REPLY_TO),
    subjectPrefix: cleanHeaderValue(process.env.ENQUIRY_EMAIL_SUBJECT_PREFIX) || '',
    baseUrl: (process.env.PUBLIC_BASE_URL || 'https://team-jd.com.au').trim()
  };
}

function isMailConfigured(config = getMailConfig()) {
  return Boolean(
    config.provider === 'resend' &&
      config.apiKey &&
      config.from &&
      config.notificationTo &&
      config.replyTo
  );
}

function createMailProvider(config, dependencies = {}) {
  if (config.provider !== 'resend') {
    throw new MailProviderError('Unsupported mail provider.', { unavailable: true });
  }

  return createResendProvider({ apiKey: config.apiKey, fetchImpl: dependencies.fetchImpl });
}

function subject(config, value) {
  return [config.subjectPrefix, value].filter(Boolean).join(' ');
}

async function deliverEnquiry(enquiry, dependencies = {}) {
  const config = getMailConfig();
  if (!isMailConfigured(config)) {
    throw new MailProviderError('Enquiry mail is not configured.', { unavailable: true });
  }

  const timestamp = dependencies.timestamp || new Date();
  const templateOptions = { baseUrl: config.baseUrl, timestamp, social: socialLinks() };
  const internal = buildInternalTemplate(enquiry, templateOptions);
  const customer = buildCustomerTemplate(enquiry, templateOptions);
  const messages = [
    {
      from: config.from,
      to: [config.notificationTo],
      reply_to: enquiry.email,
      subject: subject(config, 'New Team JD website enquiry'),
      html: internal.html,
      text: internal.text
    },
    {
      from: config.from,
      to: [enquiry.email],
      reply_to: config.replyTo,
      subject: subject(config, 'We received your Team JD enquiry'),
      html: customer.html,
      text: customer.text
    }
  ];
  const provider = dependencies.provider || createMailProvider(config, dependencies);

  return provider.sendBatch(messages, `enquiry/${enquiry.submissionId}`);
}

module.exports = {
  createMailProvider,
  deliverEnquiry,
  getMailConfig,
  isMailConfigured,
  MailProviderError
};
