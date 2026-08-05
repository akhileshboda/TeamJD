const SERVICE_LABELS = Object.freeze({
  'competition-prep': 'Competition Preparation',
  'online-coaching': 'Online Coaching',
  'personal-training': 'Personal Training',
  'posing-only': 'Posing',
  unsure: 'Not Sure Yet',
  general: 'General Question'
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEADER_BREAK_PATTERN = /[\r\n]/;

function readString(body, key) {
  return typeof body?.[key] === 'string' ? body[key].trim() : '';
}

function validateEnquiry(body) {
  const value = {
    firstName: readString(body, 'firstName'),
    lastName: readString(body, 'lastName'),
    email: readString(body, 'email').toLowerCase(),
    service: readString(body, 'service'),
    message: readString(body, 'message'),
    submissionId: readString(body, 'submissionId'),
    website: readString(body, 'website'),
    turnstileToken: readString(body, 'turnstileToken')
  };
  const fields = {};

  if (!value.firstName || value.firstName.length > 100 || HEADER_BREAK_PATTERN.test(value.firstName)) {
    fields.firstName = 'Enter a valid first name of 100 characters or fewer.';
  }
  if (value.lastName.length > 100 || HEADER_BREAK_PATTERN.test(value.lastName)) {
    fields.lastName = 'Enter a valid last name of 100 characters or fewer.';
  }
  if (
    !value.email ||
    value.email.length > 254 ||
    HEADER_BREAK_PATTERN.test(value.email) ||
    !EMAIL_PATTERN.test(value.email)
  ) {
    fields.email = 'Enter a valid email address.';
  }
  if (value.service && !SERVICE_LABELS[value.service]) {
    fields.service = 'Select a recognised service.';
  }
  if (!value.message || value.message.length > 5000) {
    fields.message = 'Enter a message of 5,000 characters or fewer.';
  }
  if (!UUID_PATTERN.test(value.submissionId)) {
    fields.submissionId = 'A valid submission reference is required.';
  }
  if (!value.turnstileToken || value.turnstileToken.length > 2048) {
    fields.turnstileToken = 'Complete the security check.';
  }

  return {
    ok: Object.keys(fields).length === 0,
    fields,
    value: {
      ...value,
      serviceLabel: value.service ? SERVICE_LABELS[value.service] : 'General Enquiry'
    }
  };
}

module.exports = { SERVICE_LABELS, validateEnquiry };
