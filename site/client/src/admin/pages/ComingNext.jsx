import { Link } from 'react-router-dom'
import JourneyIcon from '../../components/JourneyIcon'

// Placeholder for sections whose editor has not shipped yet, and for unknown paths.
export default function ComingNext({ section }) {
  if (!section) {
    return (
      <div className="jd-empty">
        <h1>Nothing here</h1>
        <p>This dashboard page does not exist.</p>
        <Link className="jd-admin-button" to="/admin">Back to Home</Link>
      </div>
    )
  }

  return (
    <div className="jd-empty">
      <JourneyIcon name={section.icon} size={28} className="jd-empty-icon" />
      <h1>{section.label}</h1>
      <p>{section.summary}</p>
      <p className="jd-empty-note">This section is being built and will appear here soon.</p>
    </div>
  )
}
