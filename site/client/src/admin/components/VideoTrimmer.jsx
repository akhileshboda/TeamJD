import { useEffect, useId, useRef, useState } from 'react'
import { formatSeconds, loopProps, loopSrc } from '../../utils/videoLoop'

// The shortest loop Jake can choose (the server checks the same).
export const MIN_LOOP_SECONDS = 2

const tenth = (value) => Math.round(value * 10) / 10

// Choose the part of a video that loops on the page. `value` is { start, end }
// in seconds, or null for the whole video. The small preview plays just that part.
export default function VideoTrimmer({ src, poster, duration, value, onChange, label = 'Video' }) {
  const videoRef = useRef(null)
  const hintId = useId()
  const [loadedDuration, setLoadedDuration] = useState(null)
  const length = Number.isFinite(duration) && duration > 0 ? duration : loadedDuration
  const trim = value || (length ? { start: 0, end: length } : null)
  const start = trim?.start ?? 0

  // Moving the start shows the new start straight away.
  useEffect(() => {
    if (videoRef.current && Number.isFinite(start)) videoRef.current.currentTime = start
  }, [start])

  const set = (next) => {
    const whole = next.start <= 0 && next.end >= length
    onChange(whole ? null : { start: tenth(next.start), end: tenth(next.end) })
  }

  const preview = loopProps(value)
  const onLoadedMetadata = (event) => {
    if (Number.isFinite(event.currentTarget.duration)) setLoadedDuration(event.currentTarget.duration)
    preview.onLoadedMetadata?.(event)
  }

  return (
    <div className="jd-trimmer" role="group" aria-label={`${label}: part that loops`} aria-describedby={hintId}>
      <span className="jd-field-label">Part that loops</span>
      <video ref={videoRef} src={loopSrc(src, value)} poster={poster} muted autoPlay playsInline aria-hidden="true"
        {...preview} onLoadedMetadata={onLoadedMetadata} />
      {!length ? (
        <p id={hintId} className="jd-field-hint">Loading the video…</p>
      ) : length < MIN_LOOP_SECONDS ? (
        <p id={hintId} className="jd-field-hint">This video is too short to trim. The whole video loops.</p>
      ) : (
        <>
          <p id={hintId} className="jd-field-hint">
            Choose where the loop starts and ends. It needs to be at least {MIN_LOOP_SECONDS} seconds long.
          </p>
          <div className="jd-trimmer-row">
            <span className="jd-field-label" aria-hidden="true">Starts at</span>
            <input type="range" aria-label="Loop starts at" min="0" max={length} step="0.1" value={trim.start}
              aria-valuetext={formatSeconds(trim.start)}
              onChange={(event) => set({ ...trim, start: Math.min(Number(event.target.value), trim.end - MIN_LOOP_SECONDS) })} />
            <output aria-hidden="true">{formatSeconds(trim.start)}</output>
          </div>
          <div className="jd-trimmer-row">
            <span className="jd-field-label" aria-hidden="true">Ends at</span>
            <input type="range" aria-label="Loop ends at" min="0" max={length} step="0.1" value={trim.end}
              aria-valuetext={formatSeconds(trim.end)}
              onChange={(event) => set({ ...trim, end: Math.max(Number(event.target.value), trim.start + MIN_LOOP_SECONDS) })} />
            <output aria-hidden="true">{formatSeconds(trim.end)}</output>
          </div>
          <div className="jd-framer-controls">
            <span className="jd-field-hint">Loop: {formatSeconds(trim.end - trim.start)} long</span>
            <button type="button" className="jd-admin-button jd-admin-button--sm jd-admin-button--quiet" disabled={!value}
              aria-label="Reset the loop to the whole video" onClick={() => onChange(null)}>
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  )
}
