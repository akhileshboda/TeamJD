export const RESULTS_PER_PAGE = 24

export const RESULT_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'competition', label: 'Competition Prep' },
  { value: 'posing', label: 'Posing' },
  { value: 'online', label: 'Online Coaching' },
  { value: 'training', label: 'Personal Training' },
  { value: 'lifestyle', label: 'Lifestyle' },
]

export const RESULT_TYPES = [
  { value: 'all', label: 'All imagery' },
  { value: 'client', label: 'Client results' },
  { value: 'representative', label: 'Representative imagery' },
]

export const RESULT_SORTS = [
  { value: 'curated', label: 'Curated order' },
  { value: 'category', label: 'Category A–Z' },
  { value: 'caption', label: 'Caption A–Z' },
]

const categoryValues = new Set(RESULT_CATEGORIES.map(({ value }) => value))
const typeValues = new Set(RESULT_TYPES.map(({ value }) => value))
const sortValues = new Set(RESULT_SORTS.map(({ value }) => value))

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
