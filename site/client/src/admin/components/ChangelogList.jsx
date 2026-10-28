import { formatChangelogDate } from '../changelog'

export default function ChangelogList({ entries }) {
  return (
    <ol className="jd-changelog">
      {entries.map((entry, index) => (
        <li key={`${entry.date}-${index}`} className="jd-changelog-entry">
          <time className="jd-changelog-date" dateTime={entry.date}>{formatChangelogDate(entry.date)}</time>
          <p className="jd-changelog-text">{entry.text}</p>
        </li>
      ))}
    </ol>
  )
}
