export const RESULTS_PER_PAGE = 24

export const RESULT_CATEGORY_LABELS = {
  competition: 'Competition Prep',
  posing: 'Posing',
  online: 'Online Coaching',
  training: 'Personal Training',
  lifestyle: 'Lifestyle',
}

export const RESULT_CATEGORIES = [
  { value: 'all', label: 'All' },
  ...Object.entries(RESULT_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
]

export const RESULT_TYPES = [
  { value: 'all', label: 'All imagery' },
  { value: 'client', label: 'Client results' },
  { value: 'representative', label: 'Representative imagery' },
]

export const RESULT_SORTS = [
  { value: 'curated', label: 'Featured' },
  { value: 'category', label: 'Category A–Z' },
  { value: 'caption', label: 'Caption A–Z' },
]

const categoryValues = new Set(RESULT_CATEGORIES.map(({ value }) => value))
const typeValues = new Set(RESULT_TYPES.map(({ value }) => value))
const sortValues = new Set(RESULT_SORTS.map(({ value }) => value))

export function getResultStory(result) {
  const item = result || {}
  const categoryLabel = RESULT_CATEGORY_LABELS[item.category] || 'Coaching'
  const isRepresentative = item.kind === 'representative'

  return {
    title: item.name || item.caption || `${categoryLabel} result`,
    categoryLabel,
    location: item.location || (isRepresentative ? 'Representative imagery' : categoryLabel),
    duration: item.duration || null,
    summary: item.summary || (
      isRepresentative
        ? `Representative fitness imagery for the ${categoryLabel.toLowerCase()} category. It is not presented as a Team JD client outcome.`
        : `A genuine Team JD client result from the ${categoryLabel.toLowerCase()} coaching archive.`
    ),
    testimonial: item.testimonial || null,
  }
}

function clampFocus(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return 50
  }
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return 50
  return Math.min(100, Math.max(0, numericValue))
}

export function getResultPresentation(result) {
  const presentation = result?.presentation || {}
  const fit = presentation.fit === 'cover' ? 'cover' : 'contain'
  const focusX = clampFocus(presentation.focus?.x)
  const focusY = clampFocus(presentation.focus?.y)

  return {
    fit,
    focusX,
    focusY,
    objectPosition: `${focusX}% ${focusY}%`,
  }
}

export function getResultsParams(searchParams) {
  const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10)
  const category = searchParams.get('category') || 'all'
  const type = searchParams.get('type') || 'all'
  const sort = searchParams.get('sort') || 'curated'

  return {
    query: searchParams.get('q') || '',
    category: categoryValues.has(category) ? category : 'all',
    type: typeValues.has(type) ? type : 'all',
    sort: sortValues.has(sort) ? sort : 'curated',
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  }
}

export function filterAndSortResults(results, filters) {
  const needle = filters.query.trim().toLocaleLowerCase()
  const filtered = results.filter((result) => {
    if (filters.category !== 'all' && result.category !== filters.category) return false
    if (filters.type !== 'all' && result.kind !== filters.type) return false
    if (!needle) return true

    const haystack = [
      result.caption,
      result.alt,
      result.category,
      ...(result.tags || []),
    ].join(' ').toLocaleLowerCase()

    return haystack.includes(needle)
  })

  return [...filtered].sort((left, right) => {
    if (filters.sort === 'caption') {
      return left.caption.localeCompare(right.caption) || left.order - right.order
    }

    if (filters.sort === 'category') {
      return left.category.localeCompare(right.category) || left.order - right.order
    }

    return left.order - right.order
  })
}

export function paginateResults(results, requestedPage, pageSize = RESULTS_PER_PAGE) {
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize))
  const page = Math.min(Math.max(1, requestedPage), totalPages)
  const startIndex = (page - 1) * pageSize

  return {
    page,
    totalPages,
    items: results.slice(startIndex, startIndex + pageSize),
    start: results.length === 0 ? 0 : startIndex + 1,
    end: Math.min(startIndex + pageSize, results.length),
  }
}

export function getPaginationRange(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  const visible = [...pages]
    .filter((page) => page > 0 && page <= totalPages)
    .sort((a, b) => a - b)
  const range = []

  visible.forEach((page, index) => {
    const previous = visible[index - 1]
    if (previous && page - previous > 1) range.push(`ellipsis-${previous}`)
    range.push(page)
  })

  return range
}

export function getCategoryCounts(results, { query, type }) {
  const counts = { all: 0 }
  RESULT_CATEGORIES.slice(1).forEach(({ value }) => { counts[value] = 0 })

  const matching = filterAndSortResults(results, {
    query,
    type,
    category: 'all',
    sort: 'curated',
  })

  matching.forEach((result) => {
    counts.all += 1
    counts[result.category] = (counts[result.category] || 0) + 1
  })

  return counts
}
