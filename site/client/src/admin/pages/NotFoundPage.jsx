import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="jd-list-page">
      <div className="jd-list-head">
        <div>
          <h1 className="jd-page-title">Nothing here</h1>
          <p className="jd-page-lede">This dashboard page does not exist.</p>
        </div>
      </div>
      <Link className="jd-admin-button" to="/admin">Back to Home</Link>
    </div>
  )
}
