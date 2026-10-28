import { Link, useSearchParams } from 'react-router-dom'
import JourneyIcon from '../../components/JourneyIcon'
import ChangelogList from '../components/ChangelogList'
import { filterEntries, orderEntries } from '../changelog'
import { useChangelog } from '../useChangelog'

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
]

const counted = (count) => `${count} ${count === 1 ? 'update' : 'updates'}`

export default function ChangelogSection() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const sort = params.get('sort') === 'oldest' ? 'oldest' : 'newest'
  const { entries, error } = useChangelog()

  // Search and sort live in the address, so a refresh or a shared link keeps them.
  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value && !(key === 'sort' && value === 'newest')) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const visible = entries && orderEntries(filterEntries(entries, query), sort)
  const searching = query.trim() !== ''

  return (
    <div className="jd-list-page">
      <Link className="jd-back" to="/admin">
        <JourneyIcon name="arrowLeft" size={16} />
        Back to Home
      </Link>
      <div className="jd-list-head">
        <div>
          <h1 className="jd-page-title">Change log</h1>
          <p className="jd-page-lede">Everything that has changed on the site, in plain English.</p>
        </div>
      </div>

      {error && <p className="jd-admin-error" role="alert">{error}</p>}
      {!entries && !error && <div className="jd-skeleton jd-skeleton--list" role="status" aria-label="Loading" />}

      {entries?.length === 0 && (
        <div className="jd-empty jd-empty--inline">
          <p>Nothing posted yet.</p>
        </div>
      )}

      {entries?.length > 0 && (
        <>
          <div className="jd-list-tools">
            <label className="jd-search">
              <JourneyIcon name="search" size={16} />
              <span className="visually-hidden">Search updates</span>
              <input className="jd-input" type="search" value={query} placeholder="Search updates or dates" spellCheck={false}
                onChange={(event) => setParam('q', event.target.value)} />
            </label>
            <label>
              <span className="visually-hidden">Sort</span>
              <select className="jd-input jd-select" value={sort} onChange={(event) => setParam('sort', event.target.value)}>
                {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          {visible.length > 0 ? (
            <>
              <p className="jd-changelog-summary" role="status">
                {searching ? `${visible.length} of ${counted(entries.length)}` : counted(entries.length)}
              </p>
              <div className="jd-panel">
                <ChangelogList entries={visible} />
              </div>
            </>
          ) : (
            <div className="jd-empty jd-empty--inline" role="status">
              <p>No updates match “{query.trim()}”.</p>
              <button type="button" className="jd-link-button" onClick={() => setParam('q', '')}>Clear search</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
