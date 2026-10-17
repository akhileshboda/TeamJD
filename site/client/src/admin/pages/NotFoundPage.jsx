import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="jd-empty">
      <h1>Nothing here</h1>
      <p>This dashboard page does not exist.</p>
      <Link className="jd-admin-button" to="/admin">Back to Home</Link>
    </div>
  )
}
