import { useId, useState } from 'react'
import JourneyIcon from '../../components/JourneyIcon'
import { ACCEPTED_FILES, uploadToLibrary } from '../api'

const KIND_WORDS = { image: 'photos', video: 'videos' }

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
                {item.state === 'uploading' && `Uploading ${item.progress || 0}%`}
                {item.state === 'processing' && 'Optimising for the web…'}
                {item.state === 'done' && 'Added to your library'}
                {item.state === 'failed' && item.error}
              </span>
              {item.state === 'uploading' && (
                <span className="jd-upload-bar" style={{ width: `${item.progress || 0}%` }} aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
