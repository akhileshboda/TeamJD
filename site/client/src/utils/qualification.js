export const FINDER_QUESTIONS = {
  intention: {
    id: 'intention',
    prompt: 'What are you most intent on achieving right now?',
    options: [
      { value: 'competition', label: 'Prepare to compete on stage' },
      { value: 'physique', label: 'Build my physique, strength, or confidence' },
      { value: 'hands-on', label: 'Improve my training technique in person' },
      { value: 'posing', label: 'Improve my posing and stage presentation' },
      { value: 'unsure', label: 'I need help deciding what support I need' },
    ],
  },
  support: {
    id: 'support',
    prompt: 'What kind of support would make the biggest difference?',
    options: [
      { value: 'full-coaching', label: 'An ongoing training and nutrition plan' },
      { value: 'hands-on', label: 'Face-to-face sessions and technique feedback' },
      { value: 'posing', label: 'Focused posing and stage-craft instruction' },
      { value: 'guidance', label: 'I want Jake to guide me to the right starting point' },
    ],
  },
  delivery: {
    id: 'delivery',
    prompt: 'Where and how can you work with Jake?',
    options: [
      { value: 'adelaide', label: 'I can train in person in Adelaide' },
      { value: 'remote', label: 'I need remote or flexible coaching' },
      { value: 'either', label: 'I can do Adelaide or online' },
    ],
  },
  readiness: {
    id: 'readiness',
    prompt: 'How ready are you to follow a structured process and communicate honestly?',
    options: [
      { value: 'ready', label: 'Ready — I can commit to the process' },
      { value: 'unsure', label: 'I need to talk through what coaching would require' },
      { value: 'not-ready', label: 'Not yet — I cannot commit consistently right now' },
    ],
  },
  training_history: {
    id: 'training_history',
    prompt: 'How long have you trained consistently with a structured plan?',
    options: [
      { value: 'under-one', label: 'Less than one year' },
      { value: 'one-to-two', label: 'One to two years' },
      { value: 'two-plus', label: 'More than two years' },
    ],
  },
  timeline: {
    id: 'timeline',
    prompt: 'If your preferred competition season is too soon, will you move the timeline?',
    options: [
      { value: 'yes', label: 'Yes — readiness comes first' },
      { value: 'unsure', label: 'I am not sure yet' },
      { value: 'no', label: 'No — I only want my current season' },
    ],
  },
}

const CORE_FINDER_QUESTIONS = [
  FINDER_QUESTIONS.intention,
  FINDER_QUESTIONS.support,
  FINDER_QUESTIONS.delivery,
  FINDER_QUESTIONS.readiness,
]

function usesCompetitionReadiness(answers) {
  return (
    answers?.intention === 'competition' &&
    answers?.support !== 'posing' &&
    answers?.readiness !== 'unsure' &&
    answers?.readiness !== 'not-ready'
  )
}

export function getFinderQuestions(answers = {}) {
  if (!usesCompetitionReadiness(answers)) return CORE_FINDER_QUESTIONS

  return [
    ...CORE_FINDER_QUESTIONS,
    FINDER_QUESTIONS.training_history,
    FINDER_QUESTIONS.timeline,
  ]
}

export function pruneFinderAnswers(answers = {}) {
  const activeIds = new Set(getFinderQuestions(answers).map((question) => question.id))
  return Object.fromEntries(
    Object.entries(answers).filter(([questionId]) => activeIds.has(questionId)),
  )
}

export function evaluateFinder(answers = {}) {
  const missingQuestionIds = getFinderQuestions(answers)
    .filter((question) => !answers?.[question.id])
    .map((question) => question.id)

  if (missingQuestionIds.length > 0) {
    return { status: 'locked', missingQuestionIds }
  }

  if (answers.readiness !== 'ready') {
    return {
      status: 'consult',
      missingQuestionIds: [],
      reason:
        answers.readiness === 'not-ready'
          ? 'You have said that consistent coaching is not realistic right now. A direct conversation is a better next step than forcing you into a service.'
          : 'You want more clarity about what coaching would require before choosing a service. Jake can help you talk through the right next step.',
      evidence: [
        'There is no pressure to book before you are ready.',
        'Share your goal and current circumstances so Jake can respond with useful context.',
      ],
    }
  }

  if (answers.intention === 'posing' || answers.support === 'posing') {
    return {
      status: 'recommended',
      missingQuestionIds: [],
      recommendationSlug: 'posing-only',
      reason: 'Posing is the most direct match for focused work on presentation, transitions, and stage confidence.',
      evidence: [
        'Your main outcome is how you present your physique on stage.',
        'This service focuses directly on positions, transitions, and repeatable presentation.',
      ],
    }
  }

  if (answers.intention === 'competition') {
    const isExperienced = answers.training_history !== 'under-one'
    const acceptsFlexibleTimeline = answers.timeline === 'yes'

    if (isExperienced && acceptsFlexibleTimeline) {
      return {
        status: 'recommended',
        missingQuestionIds: [],
        recommendationSlug: 'competition-preparation',
        qualifiesSlug: 'competition-preparation',
        reason: 'Competition Preparation is the right next assessment for your stage goal and current readiness.',
        evidence: [
          'You have at least one year of consistent, structured training.',
          'You are willing to let athlete readiness determine the competition timeline.',
          'You are ready to follow a demanding process and communicate honestly.',
        ],
      }
    }

    return {
      status: 'recommended',
      missingQuestionIds: [],
      recommendationSlug: 'online-coaching',
      reason: 'Online Coaching is the stronger starting point for building towards the stage without forcing a competition timeline too soon.',
      evidence: [
        !isExperienced
          ? 'You are still building the structured training history expected before a prep assessment.'
          : 'Your preferred competition timeline currently matters more than readiness.',
        'Ongoing training, nutrition, and feedback can build the foundation for a future prep.',
      ],
    }
  }

  if (answers.intention === 'hands-on' || answers.support === 'hands-on') {
    if (answers.delivery !== 'remote') {
      return {
        status: 'recommended',
        missingQuestionIds: [],
        recommendationSlug: 'personal-training',
        reason: 'Personal Training is the best fit for hands-on coaching, immediate feedback, and better movement in Adelaide.',
        evidence: [
          'You want face-to-face instruction and technique feedback.',
          'You can work with Jake in person in Adelaide.',
        ],
      }
    }

    return {
      status: 'recommended',
      missingQuestionIds: [],
      recommendationSlug: 'online-coaching',
      reason: 'Online Coaching is the closest fit for personalised training support when in-person sessions are not available.',
      evidence: [
        'You want meaningful coaching input rather than a generic program.',
        'You need remote or flexible delivery.',
      ],
    }
  }

  return {
    status: 'recommended',
    missingQuestionIds: [],
    recommendationSlug: 'online-coaching',
    reason: 'Online Coaching gives you an individual training and nutrition structure with flexible delivery and ongoing accountability.',
    evidence: [
      'You want an ongoing coaching relationship rather than a one-off session.',
      answers.delivery === 'remote'
        ? 'You need support that works remotely.'
        : 'You are open to a flexible coaching format.',
    ],
  }
}
