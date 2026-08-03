import { describe, expect, it } from 'vitest'
import services from '../../../public/content/services.json'
import {
  evaluateFinder,
  getFinderQuestions,
  pruneFinderAnswers,
} from './qualification'

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

  it('keeps the page and booking checkpoint exclusive to Competition Preparation', () => {
    expect(
      services.filter((candidate) => candidate.application_required).map((candidate) => candidate.slug),
    ).toEqual(['competition-preparation'])
    expect(services.every((candidate) => !candidate.qualification)).toBe(true)
  })
})
