import { useId } from 'react'
import { Link } from 'react-router-dom'
import JourneyIcon from '../../components/JourneyIcon'
import { useChangelog } from '../useChangelog'
import ChangelogList from './ChangelogList'

const RECENT_COUNT = 3

// The three latest updates on Home, with the way into the full Change log.
export default function WhatsNew() {
  const titleId = useId()
  const { entries, error } = useChangelog()

  return (
    <aside className="jd-panel jd-whatsnew" aria-labelledby={titleId}>
      <div className="jd-panel-head">
        <p id={titleId} className="jd-panel-title">What’s new</p>
        {entries?.length > 0 && (
          <Link className="jd-whatsnew-all" to="/admin/changelog">
            View all ({entries.length})
            <JourneyIcon name="arrowRight" size={14} />
          </Link>
        )}
      </div>

      {/* Updates are nice to have, so a failure here stays quiet rather than raising an alert over Home. */}
      {error && <p className="jd-panel-empty" role="status">The latest updates could not be loaded.</p>}
      {!entries && !error && <div className="jd-skeleton jd-skeleton--whatsnew" role="status" aria-label="Loading updates" />}
      {entries?.length === 0 && <p className="jd-panel-empty">Nothing posted yet.</p>}
      {entries?.length > 0 && <ChangelogList entries={entries.slice(0, RECENT_COUNT)} />}
    </aside>
  )
}
