import { useMemo, useState } from 'react'

const WIDTH = 1000
const HEIGHT = 260

const shortDate = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })
const asDate = (day) => new Date(`${day}T00:00:00Z`)

function linePath(points) {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

// Daily visits for the chosen period, with the period before as a faint dashed
// line underneath for comparison.
export default function VisitsChart({ daily }) {
  const [active, setActive] = useState(null)

  const geometry = useMemo(() => {
    const max = Math.max(1, ...daily.map((day) => Math.max(day.visits, day.previousVisits)))
    const top = max * 1.18
    const step = daily.length > 1 ? WIDTH / (daily.length - 1) : WIDTH
    const y = (value) => HEIGHT - (value / top) * HEIGHT
    const current = daily.map((day, index) => [index * step, y(day.visits)])
    const previous = daily.map((day, index) => [index * step, y(day.previousVisits)])
    return {
      step,
      current,
      currentLine: linePath(current),
      area: `${linePath(current)} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`,
      previousLine: linePath(previous),
    }
  }, [daily])

  const onPointer = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    const fraction = (event.clientX - box.left) / box.width
    setActive(Math.max(0, Math.min(daily.length - 1, Math.round(fraction * (daily.length - 1)))))
  }

  // Arrow keys walk the days for keyboard users; Escape hides the readout.
  const onKeyDown = (event) => {
    const last = daily.length - 1
    const moves = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }
    if (event.key === 'Escape') return setActive(null)
    if (!(event.key in moves)) return undefined
    event.preventDefault()
    return setActive((current) => Math.max(0, Math.min(last, (current ?? last) + moves[event.key])))
  }

  const activeDay = active === null ? null : daily[active]
  const ticks = [0, Math.floor((daily.length - 1) / 2), daily.length - 1]

  return (
    <figure className="jd-chart">
      <div
        className="jd-chart-plot"
        tabIndex={0}
        aria-label="Daily visits chart. Use the arrow keys to read each day."
        aria-describedby="jd-chart-caption"
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-labelledby="jd-chart-caption">
          <defs>
            <linearGradient id="jd-chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--jd-live)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--jd-live)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((fraction) => (
            <line key={fraction} className="jd-chart-grid" x1="0" x2={WIDTH} y1={HEIGHT * fraction} y2={HEIGHT * fraction} />
          ))}
          <path className="jd-chart-previous" d={geometry.previousLine} />
          <path className="jd-chart-area" d={geometry.area} fill="url(#jd-chart-fill)" />
          <path className="jd-chart-line" d={geometry.currentLine} />
          {activeDay && (
            <line className="jd-chart-cursor" x1={geometry.current[active][0]} x2={geometry.current[active][0]} y1="0" y2={HEIGHT} />
          )}
        </svg>
        {activeDay && (
          <div
            role="status"
            className="jd-chart-tooltip"
            style={{ left: `${(active / Math.max(1, daily.length - 1)) * 100}%` }}
            data-edge={active < daily.length * 0.2 ? 'start' : active > daily.length * 0.8 ? 'end' : undefined}
          >
            <strong>{activeDay.visits} {activeDay.visits === 1 ? 'visit' : 'visits'}</strong>
            <span>{longDate.format(asDate(activeDay.date))}</span>
            <span className="jd-chart-tooltip-muted">Period before: {activeDay.previousVisits}</span>
          </div>
        )}
      </div>
      <div className="jd-chart-axis" aria-hidden="true">
        {ticks.map((index) => (
          <span key={index}>{shortDate.format(asDate(daily[index].date))}</span>
        ))}
      </div>
      <figcaption id="jd-chart-caption" className="visually-hidden">
        Daily visits from {longDate.format(asDate(daily[0].date))} to {longDate.format(asDate(daily.at(-1).date))}:{' '}
        {daily.map((day) => `${shortDate.format(asDate(day.date))} ${day.visits}`).join(', ')}.
      </figcaption>
    </figure>
  )
}
