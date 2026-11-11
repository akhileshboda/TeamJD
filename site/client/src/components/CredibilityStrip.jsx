// The credentials band under the hero. Static, it is a wrapped row of five
// claims. On the landing page with motion on, pages/Home.jsx turns it into an
// oversized band that slides sideways as you scroll; the repeated copies exist
// only for that loop and are hidden from assistive technology.

const ITEMS = [
  'Pro Physique Competitor',
  '100+ Clients Transformed',
  'All Major Federations',
  '100% Personalised',
  'Real Coaching Relationships',
]

function Row({ hidden = false }) {
  return (
    <ul className="lp-cred-row" role="list" aria-hidden={hidden || undefined}>
      {ITEMS.map((item, index) => (
        <li key={item} className={`lp-cred-item${index % 2 ? ' lp-cred-item--outline' : ''}`}>
          <span className="lp-cred-mark" aria-hidden="true">✦</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function CredibilityStrip() {
  return (
    <div className="lp-cred" aria-label="Credentials" role="region">
      <div className="lp-cred-track">
        <Row />
        <Row hidden />
      </div>
    </div>
  )
}
