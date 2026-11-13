import { describe, expect, it } from 'vitest'
import results from '../../../server/seed/results-library.json'
import {
  RESULTS_PER_PAGE,
  filterAndSortResults,
  getAudienceCounts,
  getPaginationRange,
  getResultPresentation,
  getResultStory,
  getResultsParams,
  interleaveByAudience,
  paginateResults,
  resultAudience,
} from './resultsLibrary'

const defaultFilters = {
  query: '',
  category: 'all',
  type: 'all',
  sort: 'curated',
}

describe('Canonical results library data', () => {
  it('contains 120 unique records and the six enriched client results', () => {
    expect(results).toHaveLength(120)
    expect(new Set(results.map(({ id }) => id))).toHaveProperty('size', 120)
    expect(results.slice(0, 6).map(({ kind, featured }) => ({ kind, featured }))).toEqual(
      Array.from({ length: 6 }, () => ({ kind: 'client', featured: true })),
    )
    results.slice(0, 6).forEach((result) => {
      expect(result).toMatchObject({
        name: expect.any(String),
        summary: expect.any(String),
        testimonial: expect.any(Object),
        presentation: {
          fit: expect.stringMatching(/^(cover|contain)$/),
          focus: {
            x: expect.any(Number),
            y: expect.any(Number),
          },
        },
        stats: expect.any(Array),
      })
    })
  })

  it('normalizes subject-safe image presentation metadata', () => {
    expect(getResultPresentation(results[0])).toEqual({
      fit: 'contain',
      focusX: 50,
      focusY: 50,
      zoom: 1,
      objectPosition: '50% 50%',
    })

    expect(getResultPresentation({
      presentation: {
        fit: 'cover',
        focus: { x: -12, y: 145 },
        zoom: 9,
      },
    })).toEqual({
      fit: 'cover',
      focusX: 0,
      focusY: 100,
      zoom: 3,
      objectPosition: '0% 100%',
    })

    expect(getResultPresentation({
      presentation: {
        fit: 'unsupported',
        focus: { x: 'unknown', y: null },
      },
    })).toEqual({
      fit: 'contain',
      focusX: 50,
      focusY: 50,
      zoom: 1,
      objectPosition: '50% 50%',
    })
  })

  it('keeps every representative image on a direct external URL', () => {
    const representative = results.filter(({ kind }) => kind === 'representative')

    expect(representative).toHaveLength(114)
    representative.forEach(({ src }) => {
      expect(src).toMatch(/^https:\/\//)
      expect(src).not.toContain('/api/assets')
      expect(src.toLowerCase()).not.toContain('r2')
    })
    expect(representative.every(({ testimonial }) => testimonial === undefined)).toBe(true)
  })

  it('normalizes client and representative stories without inventing testimonials', () => {
    expect(getResultStory(results[0])).toMatchObject({
      title: results[0].name,
      categoryLabel: 'Competition Prep',
      location: results[0].location,
      duration: results[0].duration ?? null,
      summary: results[0].summary,
      testimonial: results[0].testimonial,
    })

    const representative = getResultStory(results.find(({ kind }) => kind === 'representative'))
    expect(representative.location).toBe('Representative imagery')
    expect(representative.summary).toMatch(/not presented as a Team JD client outcome/)
    expect(representative.testimonial).toBeNull()
  })
})

describe('results library browsing', () => {
  it('filters by content type, category, and searchable tags', () => {
    const filtered = filterAndSortResults(results, {
      ...defaultFilters,
      query: 'stage',
      category: 'competition',
      type: 'representative',
    })

    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every(({ category, kind }) => (
      category === 'competition' && kind === 'representative'
    ))).toBe(true)
  })

  it('mounts only one 24-item page and clamps invalid pages', () => {
    const firstPage = paginateResults(results, 1)
    const finalPage = paginateResults(results, 999)

    expect(RESULTS_PER_PAGE).toBe(24)
    expect(firstPage.items).toHaveLength(24)
    expect(firstPage.totalPages).toBe(5)
    expect(finalPage.page).toBe(5)
    expect(finalPage.items).toHaveLength(24)
  })

  it('normalizes unsupported URL parameters', () => {
    const params = new URLSearchParams('audience=aliens&category=unknown&type=nope&sort=random&page=-3&q=posing')

    expect(getResultsParams(params)).toEqual({
      query: 'posing',
      audience: 'all',
      category: 'all',
      type: 'all',
      sort: 'curated',
      page: 1,
    })
  })

  it('creates a compact page range for large result sets', () => {
    expect(getPaginationRange(10, 20)).toEqual([
      1,
      'ellipsis-1',
      9,
      10,
      11,
      'ellipsis-11',
      20,
    ])
  })

  it('takes the audience a result names, or derives it from the category', () => {
    expect(resultAudience({ audience: 'transformation', category: 'competition' })).toBe('transformation')
    expect(resultAudience({ category: 'posing' })).toBe('competitor')
    expect(resultAudience({ category: 'lifestyle' })).toBe('everyday')
    expect(resultAudience({ audience: 'bogus', category: 'training' })).toBe('everyday')
  })

  it('filters by audience from the URL', () => {
    const mixed = [
      { id: 1, order: 1, caption: 'A', alt: '', category: 'competition', kind: 'client', tags: [] },
      { id: 2, order: 2, caption: 'B', alt: '', category: 'online', audience: 'transformation', kind: 'client', tags: [] },
      { id: 3, order: 3, caption: 'C', alt: '', category: 'training', kind: 'client', tags: [] },
    ]
    const filters = getResultsParams(new URLSearchParams('audience=transformation'))
    expect(filters.audience).toBe('transformation')
    expect(filterAndSortResults(mixed, filters).map(({ id }) => id)).toEqual([2])
    expect(getAudienceCounts(mixed, filters)).toEqual({ all: 3, competitor: 1, transformation: 1, everyday: 1 })
  })

  it('interleaves audiences while keeping each audience in order', () => {
    const items = [
      { id: 'c1', category: 'competition' },
      { id: 'c2', category: 'competition' },
      { id: 'c3', category: 'posing' },
      { id: 't1', audience: 'transformation', category: 'online' },
      { id: 'e1', category: 'lifestyle' },
    ]
    expect(interleaveByAudience(items).map(({ id }) => id)).toEqual(['c1', 't1', 'e1', 'c2', 'c3'])
  })
})
