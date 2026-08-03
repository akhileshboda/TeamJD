import { describe, expect, it } from 'vitest'
import services from '../../../public/content/services.json'
import {
  clearServiceQualification,
  evaluateFinder,
  evaluateQualification,
  getFinderQuestions,
  getQualificationStorageKey,
  isServiceQualified,
  markServiceQualified,
  pruneFinderAnswers,
} from './qualification'

function service(slug) {
  return services.find((candidate) => candidate.slug === slug)
}

function passingAnswers(slug) {
  return Object.fromEntries(
    service(slug).qualification.questions.map((question) => [
      question.id,
      question.options.find((option) => option.qualifies)?.value,
    ])
  )
}

describe('evaluateQualification', () => {
  it('keeps an incomplete check locked and reports missing questions', () => {
    const result = evaluateQualification(service('competition-preparation').qualification, {})

    expect(result.status).toBe('locked')
    expect(result.missingQuestionIds).toEqual(['training_history', 'timeline', 'commitment'])
  })

  it.each(services.filter((candidate) => candidate.qualification).map((candidate) => candidate.slug))(
    'qualifies a complete passing answer set for %s',
    (slug) => {
      const result = evaluateQualification(service(slug).qualification, passingAnswers(slug))
      expect(result).toMatchObject({ status: 'qualified' })
    }
  )

  it('routes an athlete with insufficient training history to Online Coaching', () => {
    const answers = {
      ...passingAnswers('competition-preparation'),
      training_history: 'under-one',
    }

    expect(evaluateQualification(service('competition-preparation').qualification, answers)).toMatchObject({
      status: 'redirect',
      recommendationSlug: 'online-coaching',
    })
  })

  it('routes an athlete who will not move their season to Online Coaching', () => {
    const answers = {
      ...passingAnswers('competition-preparation'),
      timeline: 'no',
    }

    expect(evaluateQualification(service('competition-preparation').qualification, answers)).toMatchObject({
      status: 'redirect',
      recommendationSlug: 'online-coaching',
    })
  })

  it('prioritises a non-commitment block over a product recommendation', () => {
    const answers = {
      training_history: 'under-one',
      timeline: 'yes',
      commitment: 'not-yet',
    }
    const result = evaluateQualification(service('competition-preparation').qualification, answers)

    expect(result.status).toBe('redirect')
    expect(result.recommendationSlug).toBeNull()
    expect(result.response).toContain('Take the time you need')
  })

  it('keeps qualification data exclusive to Competition Preparation', () => {
    expect(
      services.filter((candidate) => candidate.qualification).map((candidate) => candidate.slug),
    ).toEqual(['competition-preparation'])
    expect(
      services.filter((candidate) => candidate.slug !== 'competition-preparation')
        .every((candidate) => candidate.application_required === false),
    ).toBe(true)
  })
})

describe('evaluateFinder', () => {
  const readyAnswers = {
    intention: 'physique',
    support: 'full-coaching',
    delivery: 'either',
    readiness: 'ready',
  }

  it('requires every question on the active branch', () => {
    expect(evaluateFinder({ intention: 'competition' })).toMatchObject({
      status: 'locked',
      missingQuestionIds: [
        'support',
        'delivery',
        'readiness',
        'training_history',
        'timeline',
      ],
    })
  })

  it.each([
    [{ ...readyAnswers }, 'online-coaching'],
    [{ ...readyAnswers, intention: 'posing', support: 'guidance' }, 'posing-only'],
    [{ ...readyAnswers, support: 'posing' }, 'posing-only'],
    [{ ...readyAnswers, intention: 'hands-on', support: 'hands-on', delivery: 'adelaide' }, 'personal-training'],
    [{ ...readyAnswers, intention: 'hands-on', support: 'hands-on', delivery: 'remote' }, 'online-coaching'],
  ])('maps a completed standard path to %s', (answers, recommendationSlug) => {
    expect(evaluateFinder(answers)).toMatchObject({
      status: 'recommended',
      recommendationSlug,
    })
  })

  it('qualifies an experienced, timeline-flexible competition athlete', () => {
    expect(evaluateFinder({
      ...readyAnswers,
      intention: 'competition',
      training_history: 'one-to-two',
      timeline: 'yes',
    })).toMatchObject({
      status: 'recommended',
      recommendationSlug: 'competition-preparation',
      qualifiesSlug: 'competition-preparation',
    })
  })

  it.each([
    ['under-one', 'yes'],
    ['two-plus', 'no'],
    ['two-plus', 'unsure'],
  ])('routes prep candidates with history %s and timeline %s to online coaching', (trainingHistory, timeline) => {
    expect(evaluateFinder({
      ...readyAnswers,
      intention: 'competition',
      training_history: trainingHistory,
      timeline,
    })).toMatchObject({
      status: 'recommended',
      recommendationSlug: 'online-coaching',
    })
  })

  it.each(['unsure', 'not-ready'])('routes %s coaching readiness to a personal consult', (readiness) => {
    expect(evaluateFinder({ ...readyAnswers, readiness })).toMatchObject({
      status: 'consult',
    })
  })

  it('adds prep questions only while they are relevant and prunes abandoned answers', () => {
    const prepAnswers = {
      ...readyAnswers,
      intention: 'competition',
      training_history: 'two-plus',
      timeline: 'yes',
    }

    expect(getFinderQuestions(prepAnswers)).toHaveLength(6)

    const posingAnswers = pruneFinderAnswers({
      ...prepAnswers,
      support: 'posing',
    })

    expect(getFinderQuestions(posingAnswers)).toHaveLength(4)
    expect(posingAnswers).not.toHaveProperty('training_history')
    expect(posingAnswers).not.toHaveProperty('timeline')
  })
})

describe('session-only qualification storage', () => {
  function storageDouble() {
    const values = new Map()
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    }
  }

  it('stores only a qualified flag under the service-specific key', () => {
    const storage = storageDouble()
    const slug = 'competition-preparation'

    expect(isServiceQualified(slug, storage)).toBe(false)
    markServiceQualified(slug, storage)
    expect(storage.getItem(getQualificationStorageKey(slug))).toBe('qualified')
    expect(isServiceQualified(slug, storage)).toBe(true)

    clearServiceQualification(slug, storage)
    expect(isServiceQualified(slug, storage)).toBe(false)
  })
})
