import { describe, expect, it } from 'vitest'
import results from '../../../public/content/results-library.json'
import {
  RESULTS_PER_PAGE,
  filterAndSortResults,
  getPaginationRange,
  getResultsParams,
  paginateResults,
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
        stats: expect.any(Array),
      })
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
    const params = new URLSearchParams('category=unknown&type=nope&sort=random&page=-3&q=posing')

    expect(getResultsParams(params)).toEqual({
      query: 'posing',
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
})
