export const QUALIFICATION_STORAGE_PREFIX = 'teamjd:service-qualification:'

export const FINDER_QUESTIONS = [
  {
    id: 'goal',
    prompt: 'What result are you looking for right now?',
    options: [
      { value: 'competition', label: 'Prepare for a physique competition' },
      { value: 'coaching', label: 'Build my physique with ongoing coaching' },
      { value: 'hands-on', label: 'Train with Jake in person' },
      { value: 'posing', label: 'Improve my posing and stage presence' },
    ],
  },
  {
    id: 'delivery',
    prompt: 'How do you need the coaching delivered?',
    options: [
      { value: 'melbourne', label: 'I can train in Melbourne' },
      { value: 'remote', label: 'I need remote or flexible support' },
      { value: 'either', label: 'I am open to either' },
    ],
  },
]

export function evaluateQualification(qualification, answers) {
  if (!qualification?.questions?.length) {
    return { status: 'locked', missingQuestionIds: [] }
  }

  const missingQuestionIds = qualification.questions
    .filter((question) => !answers?.[question.id])
    .map((question) => question.id)

  if (missingQuestionIds.length > 0) {
    return { status: 'locked', missingQuestionIds }
  }

  const failures = qualification.questions
    .map((question) => {
      const selected = question.options.find((option) => option.value === answers[question.id])
      return selected && selected.qualifies === false ? selected : null
    })
    .filter(Boolean)

  if (failures.length === 0) {
    return { status: 'qualified', missingQuestionIds: [] }
  }

  // A commitment failure takes priority over a service recommendation. It would
  // be misleading to route someone into another coaching product when they have
  // said they are not ready to participate in the coaching relationship itself.
  const commitmentBlock = failures.find((failure) => !failure.recommend_slug)
  const selectedFailure = commitmentBlock || failures[0]

  return {
    status: 'redirect',
    missingQuestionIds: [],
    recommendationSlug: selectedFailure.recommend_slug || null,
    response: selectedFailure.response || null,
  }
}

export function evaluateFinder(answers) {
  const missingQuestionIds = FINDER_QUESTIONS
    .filter((question) => !answers?.[question.id])
    .map((question) => question.id)

  if (missingQuestionIds.length > 0) {
    return { status: 'locked', missingQuestionIds }
  }

  let recommendationSlug = 'online-coaching'
  let reason = 'Ongoing online coaching gives you complete structure with flexible delivery.'

  if (answers.goal === 'competition') {
    recommendationSlug = 'competition-preparation'
    reason = 'Competition Preparation is the place to understand readiness, expectations, and a realistic stage timeline.'
  } else if (answers.goal === 'posing') {
    recommendationSlug = 'posing-only'
    reason = 'Posing gives you focused instruction on presentation, transitions, and stage confidence.'
  } else if (answers.goal === 'hands-on' && answers.delivery !== 'remote') {
    recommendationSlug = 'personal-training'
    reason = 'Personal Training gives you face-to-face technique coaching in Melbourne.'
  } else if (answers.goal === 'hands-on' && answers.delivery === 'remote') {
    reason = 'Because you need remote delivery, Online Coaching is the closest fit for personalised training support.'
  }

  return {
    status: 'recommended',
    missingQuestionIds: [],
    recommendationSlug,
    reason,
  }
}

export function getQualificationStorageKey(slug) {
  return `${QUALIFICATION_STORAGE_PREFIX}${slug}`
}

function getSessionStorage(storage) {
  if (storage) return storage
  if (typeof window === 'undefined') return null

  try {
    return window.sessionStorage
  } catch (_) {
    return null
  }
}

export function isServiceQualified(slug, storage) {
  const sessionStorage = getSessionStorage(storage)
  if (!sessionStorage || !slug) return false

  try {
    return sessionStorage.getItem(getQualificationStorageKey(slug)) === 'qualified'
  } catch (_) {
    return false
  }
}

export function markServiceQualified(slug, storage) {
  const sessionStorage = getSessionStorage(storage)
  if (!sessionStorage || !slug) return

  try {
    sessionStorage.setItem(getQualificationStorageKey(slug), 'qualified')
  } catch (_) {}
}

export function clearServiceQualification(slug, storage) {
  const sessionStorage = getSessionStorage(storage)
  if (!sessionStorage || !slug) return

  try {
    sessionStorage.removeItem(getQualificationStorageKey(slug))
  } catch (_) {}
}
