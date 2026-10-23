import { useId, useState } from 'react'
import JourneyIcon from '../../components/JourneyIcon'
import { ACCEPTED_FILES, uploadToLibrary } from '../api'

const KIND_WORDS = { image: 'photos', video: 'videos' }
// Like the dashboard's toasts: a finished upload clears itself, a failed one
// stays until closed.
const DONE_MS = 5000

function describeKinds(kinds) {
  return kinds.map((kind) => KIND_WORDS[kind]).join(' or ')
}

// Click or drop files to add them to the media library. Files upload one at a
// time; each reports its own progress and any error in plain words.
export default function MediaUploader({ kinds = ['image', 'video'], multiple = true, onUploaded, compact = false }) {
  const inputId = useId()
  const [queue, setQueue] = useState([])
  const [dragging, setDragging] = useState(false)

  const setItem = (key, patch) => setQueue((items) => items.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  const removeItem = (key) => setQueue((items) => items.filter((item) => item.key !== key))

  const uploadAll = async (files) => {
    const items = [...files].map((file, index) => ({ key: `${Date.now()}-${index}-${file.name}`, file, name: file.name, state: 'waiting' }))
    setQueue((current) => [...current.filter((item) => item.state === 'uploading'), ...items])
    for (const item of items) {
      setItem(item.key, { state: 'uploading', progress: 0 })
      try {
        const asset = await uploadToLibrary(item.file, {
          onProgress: ({ phase, fraction }) => setItem(item.key, phase === 'processing'
            ? { state: 'processing' }
            : { progress: Math.round(fraction * 100) }),
        })
        setItem(item.key, { state: 'done' })
        setTimeout(() => removeItem(item.key), DONE_MS)
        onUploaded?.(asset)
      } catch (error) {
        setItem(item.key, { state: 'failed', error: error.message })
      }
    }
  }

  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files?.length) uploadAll(multiple ? event.dataTransfer.files : [event.dataTransfer.files[0]])
  }

  const busy = queue.some((item) => ['waiting', 'uploading', 'processing'].includes(item.state))

  return (
    <div className={`jd-uploader${compact ? ' jd-uploader--compact' : ''}`}>
      <label
        htmlFor={inputId}
        className={`jd-dropzone${dragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <JourneyIcon name="upload" size={22} />
        <span>
          <strong>{busy ? 'Uploading…' : `Upload ${describeKinds(kinds)}`}</strong>
          <small>
            Choose from your {compact ? 'device' : 'phone or computer'}, or drop files here.
            {' '}Photos up to 30 MB; videos up to 3 minutes.
          </small>
        </span>
        <input
          id={inputId}
          type="file"
          className="visually-hidden"
          accept={kinds.map((kind) => ACCEPTED_FILES[kind]).join(',')}
          multiple={multiple}
          onChange={(event) => {
            if (event.target.files?.length) uploadAll(event.target.files)
            event.target.value = ''
          }}
        />
      </label>
      {queue.length > 0 && (
        <ul className="jd-upload-queue" aria-live="polite">
          {queue.map((item) => (
            <li key={item.key} className={`jd-upload-item is-${item.state}`}>
              <span className="jd-upload-name">{item.name}</span>
              <span className="jd-upload-state">
                {item.state === 'waiting' && 'Waiting…'}
                {/* Only changes of state are announced, not every percent. */}
                {item.state === 'uploading' && <>Uploading<span aria-hidden="true"> {item.progress || 0}%</span></>}
                {item.state === 'processing' && 'Optimising for the web…'}
                {item.state === 'done' && 'Added to your library'}
                {item.state === 'failed' && item.error}
              </span>
              {item.state === 'failed' && (
                <button type="button" className="jd-toast-close" aria-label={`Close the message about ${item.name}`} onClick={() => removeItem(item.key)}>
                  <JourneyIcon name="close" size={16} />
                </button>
              )}
              {item.state === 'uploading' && (
                <span className="jd-upload-bar" style={{ width: `${item.progress || 0}%` }}
                  role="progressbar" aria-label={`Uploading ${item.name}`} aria-valuenow={item.progress || 0} aria-valuemin={0} aria-valuemax={100} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
