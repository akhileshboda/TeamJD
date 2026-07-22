import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReducedMotion } from 'motion/react'
import PageHero from '../components/PageHero'
import CTABanner from '../components/CTABanner'
import ResultCard from '../components/ResultCard'
import ResultsViewer from '../components/ResultsViewer'
import SectionReveal from '../components/SectionReveal'
import { useJSON } from '../hooks/useJSON'
import {
  RESULT_CATEGORIES,
  RESULT_SORTS,
  RESULT_TYPES,
  RESULTS_PER_PAGE,
  filterAndSortResults,
  getCategoryCounts,
  getPaginationRange,
  getResultsParams,
  paginateResults,
} from '../utils/resultsLibrary'

const DEFAULT_PARAMS = {
  category: 'all',
  type: 'all',
  sort: 'curated',
  page: 1,
}

export default function Results() {
  const { data: results, loading, error } = useJSON('/content/results-library.json')
  const [searchParams, setSearchParams] = useSearchParams()
  const shouldReduceMotion = useReducedMotion()
  const libraryRef = useRef(null)
  const summaryRef = useRef(null)
  const viewerOriginRef = useRef(null)
  const [selectedId, setSelectedId] = useState(null)
  const [isSearchVisible, setIsSearchVisible] = useState(true)

  const filters = getResultsParams(searchParams)
  const filtered = useMemo(
    () => filterAndSortResults(results || [], filters),
    [filters.category, filters.query, filters.sort, filters.type, results],
  )
  const pagination = useMemo(
    () => paginateResults(filtered, filters.page),
    [filtered, filters.page],
  )
  const categoryCounts = useMemo(
    () => getCategoryCounts(results || [], filters),
    [filters.query, filters.type, results],
  )
  const paginationRange = getPaginationRange(pagination.page, pagination.totalPages)
  const selectedIndex = selectedId === null
    ? -1
    : filtered.findIndex((result) => String(result.id) === String(selectedId))
  const selectedResult = selectedIndex >= 0 ? filtered[selectedIndex] : null
  const previousResult = selectedIndex > 0 ? filtered[selectedIndex - 1] : null
  const nextResult = selectedIndex >= 0 && selectedIndex < filtered.length - 1
    ? filtered[selectedIndex + 1]
    : null
  const hasActiveFilters = Boolean(
    filters.query || filters.category !== 'all' || filters.type !== 'all' || filters.sort !== 'curated',
  )

  const updateParams = (updates, { replace = false } = {}) => {
    const next = new URLSearchParams(searchParams)

    Object.entries(updates).forEach(([key, value]) => {
      const defaultValue = DEFAULT_PARAMS[key]
      if (value === '' || value === null || value === undefined || value === defaultValue) {
        next.delete(key)
      } else {
        next.set(key, String(value))
      }
    })

    setSearchParams(next, { replace })
  }

  useEffect(() => {
    if (filters.page !== pagination.page) {
      updateParams({ page: pagination.page }, { replace: true })
    }
  // updateParams intentionally uses the latest searchParams while this effect only responds to page clamping.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, pagination.page])

  useEffect(() => {
    if (selectedId !== null && selectedIndex === -1) setSelectedId(null)
  }, [selectedId, selectedIndex])

  const resetFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: false })
  }

  const moveToPage = (page) => {
    if (page === pagination.page || page < 1 || page > pagination.totalPages) return
    updateParams({ page })
    setSelectedId(null)

    window.requestAnimationFrame(() => {
      libraryRef.current?.scrollIntoView({
        behavior: shouldReduceMotion ? 'auto' : 'smooth',
        block: 'start',
      })
      summaryRef.current?.focus({ preventScroll: true })
    })
  }

  const openResult = (result, trigger) => {
    viewerOriginRef.current = trigger
    setSelectedId(result.id)
  }

  const selectViewerResult = (result) => {
    if (!result) return
    const index = filtered.findIndex((candidate) => String(candidate.id) === String(result.id))
    if (index < 0) return

    setSelectedId(result.id)
    const targetPage = Math.floor(index / RESULTS_PER_PAGE) + 1
    if (targetPage !== pagination.page) updateParams({ page: targetPage }, { replace: true })
  }

  const closeViewer = () => {
    const closingId = selectedId
    setSelectedId(null)

    window.requestAnimationFrame(() => {
      if (viewerOriginRef.current?.isConnected) {
        viewerOriginRef.current.focus()
        return
      }

      const replacement = document.querySelector(`[data-result-id="${String(closingId)}"]`)
      if (replacement) replacement.focus()
      else summaryRef.current?.focus()
    })
  }

  return (
    <div className="results-page">
      <PageHero
        eyebrow="Client Results"
        title="Proof in the Prep."
        subtitle="Explore genuine Team JD client outcomes alongside a growing visual library of training, posing, and coaching references."
      />

      <section ref={libraryRef} className="results-library" aria-labelledby="results-heading">
        <div className="container">
          <SectionReveal>
            <div className="results-library-intro">
              <div>
                <span className="eyebrow">Results Library</span>
                <h2 id="results-heading">Find the work that matches your goal.</h2>
              </div>
              <p>
                Search by coaching focus, narrow the category, or move through the curated
                collection without loading hundreds of images at once.
              </p>
            </div>
          </SectionReveal>

          <div className="results-toolbar-sticky">
            <div className="results-toolbar" aria-label="Browse results">
              <div className="results-toolbar-inner">
                <div className="results-toolbar-actions">
                  <button
                    type="button"
                    className="results-search-toggle"
                    aria-expanded={isSearchVisible}
                    aria-controls={isSearchVisible ? 'results-search-field' : undefined}
                    onClick={() => setIsSearchVisible((visible) => !visible)}
                  >
                    {isSearchVisible ? 'Hide search' : 'Show search'}
                  </button>
                </div>

                <div className={`results-toolbar-primary${isSearchVisible ? '' : ' is-search-hidden'}`}>
                  {isSearchVisible && (
                    <label className="results-search">
                      <span>Search the library</span>
                      <input
                        id="results-search-field"
                        type="search"
                        value={filters.query}
                        placeholder="Search by service, focus, or keyword"
                        aria-controls="results-grid"
                        onChange={(event) => updateParams(
                          { q: event.target.value, page: 1 },
                          { replace: true },
                        )}
                      />
                    </label>
                  )}

                  <label className="results-select">
                    <span>Content type</span>
                    <select
                      value={filters.type}
                      onChange={(event) => updateParams({ type: event.target.value, page: 1 })}
                    >
                      {RESULT_TYPES.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="results-select">
                    <span>Sort results</span>
                    <select
                      value={filters.sort}
                      onChange={(event) => updateParams({ sort: event.target.value, page: 1 })}
                    >
                      {RESULT_SORTS.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="results-category-row">
                  <div className="results-category-rail" role="group" aria-label="Filter by category">
                    {RESULT_CATEGORIES.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        className={`results-category-chip${filters.category === value ? ' is-active' : ''}`}
                        aria-label={`${label}, ${categoryCounts[value] || 0} results`}
                        aria-pressed={filters.category === value}
                        onClick={() => updateParams({ category: value, page: 1 })}
                      >
                        <span>{label}</span>
                        <span className="results-category-count">{categoryCounts[value] || 0}</span>
                      </button>
                    ))}
                  </div>

                  {hasActiveFilters && (
                    <button type="button" className="results-clear" onClick={resetFilters}>
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            ref={summaryRef}
            className="results-summary"
            tabIndex={-1}
            aria-live="polite"
          >
            <p>
              {filtered.length === 0
                ? 'No matching results'
                : `Showing ${pagination.start}–${pagination.end} of ${filtered.length} results`}
            </p>
            <span>Page {pagination.page} of {pagination.totalPages}</span>
          </div>

          {loading && (
            <div className="results-grid results-grid--loading" aria-label="Loading results">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={index} className="result-card-skeleton" />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="results-state" role="alert">
              <span className="eyebrow">Library unavailable</span>
              <h3>We couldn’t load the results just now.</h3>
              <p>Please check your connection and try again.</p>
              <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && pagination.items.length > 0 && (
            <div id="results-grid" className="results-grid">
              {pagination.items.map((result, index) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  onOpen={openResult}
                  priority={index < 4}
                />
              ))}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="results-state">
              <span className="eyebrow">No matches</span>
              <h3>Try a broader search.</h3>
              <p>Clear a filter or search for a different coaching focus.</p>
              <button type="button" className="btn btn-outline" onClick={resetFilters}>
                Reset Library
              </button>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && pagination.totalPages > 1 && (
            <nav className="results-pagination" aria-label="Results pages">
              <button
                type="button"
                className="results-pagination-direction"
                disabled={pagination.page === 1}
                onClick={() => moveToPage(pagination.page - 1)}
              >
                <span aria-hidden="true">←</span> Previous
              </button>

              <div className="results-pagination-pages">
                {paginationRange.map((item) => (
                  typeof item === 'number' ? (
                    <button
                      key={item}
                      type="button"
                      className={item === pagination.page ? 'is-active' : ''}
                      aria-current={item === pagination.page ? 'page' : undefined}
                      aria-label={`Page ${item}`}
                      onClick={() => moveToPage(item)}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={item} aria-hidden="true">…</span>
                  )
                ))}
              </div>

              <span className="results-pagination-mobile-status">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                className="results-pagination-direction"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => moveToPage(pagination.page + 1)}
              >
                Next <span aria-hidden="true">→</span>
              </button>
            </nav>
          )}
        </div>
      </section>

      <CTABanner
        analyticsLocation="results_final_cta"
        eyebrow="Your Result Starts Here"
        title="Ready to build your own result?"
        description="Explore the coaching options, find the level of support that fits your goal, and take the next step with a clear plan."
        actions={[
          {
            label: 'Explore Services',
            to: '/services',
            variant: 'primary',
            analyticsId: 'explore_services',
          },
          {
            label: 'Find Your Fit',
            to: '/services#find-your-fit',
            variant: 'secondary',
            analyticsId: 'find_your_fit',
          },
        ]}
      />

      <ResultsViewer
        result={selectedResult}
        position={selectedIndex + 1}
        total={filtered.length}
        previousResult={previousResult}
        nextResult={nextResult}
        onPrevious={() => selectViewerResult(previousResult)}
        onNext={() => selectViewerResult(nextResult)}
        onClose={closeViewer}
      />
    </div>
  )
}
