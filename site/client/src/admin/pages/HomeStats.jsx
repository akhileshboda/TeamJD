import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useContent } from '../../hooks/useContent'
import { getStats } from '../api'
import VisitsChart from '../components/VisitsChart'

const RANGES = [
  { value: '7d', label: '7 days', heading: 'Your site over the last 7 days' },
  { value: '30d', label: '30 days', heading: 'Your site over the last 30 days' },
  { value: '90d', label: '90 days', heading: 'Your site over the last 90 days' },
]

const STATIC_PAGES = {
  '/': 'Home',
  '/about': 'About',
  '/services': 'Services',
  '/results': 'Results',
  '/contact': 'Contact',
  '/privacy': 'Privacy policy',
}

const number = new Intl.NumberFormat('en-AU')

export function pageLabel(path, services = []) {
  if (STATIC_PAGES[path]) return STATIC_PAGES[path]
  const slug = path.match(/^\/services\/([^/]+)$/)?.[1]
  if (slug) return services.find((service) => service.slug === slug)?.name || slug.replace(/-/g, ' ')
  return path
}

export function changeLabel(current, previous) {
  if (!previous) return current ? { tone: 'neutral', text: 'No visits in the period before' } : null
  const change = Math.round(((current - previous) / previous) * 100)
  if (change === 0) return { tone: 'neutral', text: 'Same as the period before' }
  return {
    tone: change > 0 ? 'up' : 'down',
    text: `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)}% on the period before`,
  }
}

// `itemHeading` names what is ranked ("Page"); `label` what is counted ("views").
function RankedList({ title, itemHeading, items, total, label }) {
  return (
    <section className="jd-panel">
      <h2 className="jd-panel-title">{title}</h2>
      {items.length === 0 ? (
        <p className="jd-panel-empty">Nothing yet.</p>
      ) : (
        <>
          <p className="jd-ranked-head" aria-hidden="true">
            <span>{itemHeading}</span>
            <span>{label.charAt(0).toUpperCase() + label.slice(1)}</span>
          </p>
          <ol className="jd-ranked">
            {items.map((item) => {
              const share = total ? item.count / total : 0
              return (
                <li key={item.key} className="jd-ranked-row">
                  <span className="jd-ranked-bar" style={{ width: `${Math.max(4, share * 100)}%` }} aria-hidden="true" />
                  <span className="jd-ranked-label">{item.label}</span>
                  <span className="jd-ranked-count">
                    {number.format(item.count)}
                    <span className="visually-hidden"> {label}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}

export default function HomeStats() {
  // The period lives in the URL so a refresh or shared link keeps it.
  const [searchParams, setSearchParams] = useSearchParams()
  const range = RANGES.some((item) => item.value === searchParams.get('range')) ? searchParams.get('range') : '30d'
  const setRange = (value) => setSearchParams(value === '30d' ? {} : { range: value }, { replace: true })
  const [state, setState] = useState({ status: 'loading' })
  const { data: services } = useContent('services')

  useEffect(() => {
    let cancelled = false
    setState((previous) => ({ ...previous, status: previous.stats ? 'refreshing' : 'loading' }))
    getStats(range)
      .then((stats) => !cancelled && setState({ status: 'ready', stats }))
      .catch((error) => !cancelled && setState({ status: 'error', error: error.message }))
    return () => {
      cancelled = true
    }
  }, [range])

  const { stats } = state
  const rangeInfo = RANGES.find((item) => item.value === range)
  const change = stats && changeLabel(stats.current.visits, stats.previous.visits)
  const pagesPerVisit = stats?.current.visits ? stats.current.pageViews / stats.current.visits : 0
  const empty = stats && stats.current.pageViews === 0 && stats.previous.pageViews === 0

  return (
    <div className="jd-home">
      <div className="jd-home-head">
        <h1 className="jd-page-title">{rangeInfo.heading}</h1>
        <div className="jd-segmented" role="group" aria-label="Period">
          {RANGES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={range === item.value}
              onClick={() => setRange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {state.status === 'error' && <p className="jd-admin-error" role="alert">{state.error}</p>}
      {state.status === 'loading' && <div className="jd-skeleton jd-skeleton--scoreboard" role="status" aria-label="Loading visits" />}

      {stats && (
        <div className={`jd-home-body${state.status === 'refreshing' ? ' is-refreshing' : ''}`} aria-busy={state.status === 'refreshing'}>
          <section className="jd-scoreboard" aria-label="Visits">
            <div className="jd-scoreboard-figures">
              <div className="jd-scoreboard-main">
                <p className="jd-scoreboard-value">{number.format(stats.current.visits)}</p>
                <p className="jd-scoreboard-label">visits</p>
                {change && <p className={`jd-change jd-change--${change.tone}`}>{change.text}</p>}
              </div>
              <dl className="jd-scoreboard-side">
                <div>
                  <dt>Page views</dt>
                  <dd>{number.format(stats.current.pageViews)}</dd>
                </div>
                <div>
                  <dt>Pages per visit</dt>
                  <dd>{pagesPerVisit ? pagesPerVisit.toFixed(1) : '–'}</dd>
                </div>
              </dl>
            </div>
            {empty ? (
              <p className="jd-scoreboard-empty">
                No visits counted yet. Counting starts once this version of the site is live, and every
                visit after that shows up here.
              </p>
            ) : (
              <VisitsChart daily={stats.daily} />
            )}
            <p className="jd-chart-legend">
              <span className="jd-legend-live">This period</span>
              <span className="jd-legend-previous">Period before</span>
            </p>
          </section>

          <div className="jd-home-grid">
            <RankedList
              title="Most viewed pages"
              itemHeading="Page"
              label="views"
              total={stats.current.pageViews}
              items={stats.topPages.map((item) => ({ key: item.path, label: pageLabel(item.path, services || []), count: item.count }))}
            />
            <RankedList
              title="Where visitors came from"
              itemHeading="Source"
              label="visits"
              total={stats.current.visits}
              items={stats.sources.map((item) => ({ key: item.source, label: item.source, count: item.count }))}
            />
          </div>
          <p className="jd-footnote">
            Counted without cookies. Visits from you and anyone else signed in to this dashboard are left out.
          </p>
        </div>
      )}
    </div>
  )
}
