const { buildCustomerTemplate, buildInternalTemplate } = require('../enquiryTemplates');
const { createResendProvider, MailProviderError } = require('./resend');

function cleanHeaderValue(value) {
  const result = String(value || '').trim();
  if (!result || /[\r\n]/.test(result)) return null;
  return result;
}

function getMailConfig() {
  return {
    provider: cleanHeaderValue(process.env.ENQUIRY_MAIL_PROVIDER),
    apiKey: (process.env.RESEND_API_KEY || '').trim(),
    from: cleanHeaderValue(process.env.ENQUIRY_EMAIL_FROM),
    notificationTo: cleanHeaderValue(process.env.ENQUIRY_NOTIFICATION_TO),
    replyTo: cleanHeaderValue(process.env.ENQUIRY_REPLY_TO),
    subjectPrefix: cleanHeaderValue(process.env.ENQUIRY_EMAIL_SUBJECT_PREFIX) || '',
    emailPublicBaseUrl: (
      process.env.ENQUIRY_EMAIL_PUBLIC_BASE_URL ||
      process.env.PUBLIC_BASE_URL ||
      'https://team-jd.com.au'
    ).trim()
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
  const internal = buildInternalTemplate(enquiry, { timestamp });
  const customer = buildCustomerTemplate(enquiry, { baseUrl: config.emailPublicBaseUrl });
  const messages = [
    {
      from: config.from,
      to: [config.notificationTo],
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
