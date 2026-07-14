import { describe, expect, it } from 'vitest'
import services from '../../../public/content/services.json'
import {
  clearServiceQualification,
  evaluateFinder,
  evaluateQualification,
  getQualificationStorageKey,
  isServiceQualified,
  markServiceQualified,
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

  it.each(services.map((candidate) => candidate.slug))(
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

  it.each([
    ['online-coaching', 'support_type', 'hands-on', 'personal-training'],
    ['online-coaching', 'support_type', 'posing', 'posing-only'],
    ['online-coaching', 'support_type', 'contest', 'competition-preparation'],
    ['personal-training', 'support_type', 'remote-complete', 'online-coaching'],
    ['personal-training', 'support_type', 'posing', 'posing-only'],
    ['personal-training', 'support_type', 'contest', 'competition-preparation'],
    ['personal-training', 'location', 'no', 'online-coaching'],
    ['posing-only', 'support_type', 'contest', 'competition-preparation'],
    ['posing-only', 'support_type', 'physique', 'online-coaching'],
  ])('routes %s answer %s=%s to %s', (slug, questionId, value, recommendationSlug) => {
    const answers = { ...passingAnswers(slug), [questionId]: value }
    const result = evaluateQualification(service(slug).qualification, answers)

    expect(result).toMatchObject({ status: 'redirect', recommendationSlug })
  })
})

describe('evaluateFinder', () => {
  it('requires both finder answers', () => {
    expect(evaluateFinder({ goal: 'competition' })).toMatchObject({
      status: 'locked',
      missingQuestionIds: ['delivery'],
    })
  })

  it.each([
    ['competition', 'remote', 'competition-preparation'],
    ['posing', 'melbourne', 'posing-only'],
    ['coaching', 'either', 'online-coaching'],
    ['hands-on', 'melbourne', 'personal-training'],
    ['hands-on', 'remote', 'online-coaching'],
  ])('maps %s with %s delivery to %s', (goal, delivery, recommendationSlug) => {
    expect(evaluateFinder({ goal, delivery })).toMatchObject({
      status: 'recommended',
      recommendationSlug,
    })
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
    const slug = 'online-coaching'

    expect(isServiceQualified(slug, storage)).toBe(false)
    markServiceQualified(slug, storage)
    expect(storage.getItem(getQualificationStorageKey(slug))).toBe('qualified')
    expect(isServiceQualified(slug, storage)).toBe(true)

    clearServiceQualification(slug, storage)
    expect(isServiceQualified(slug, storage)).toBe(false)
  })
})
