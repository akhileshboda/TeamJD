import { useEffect, useState } from 'react'
import { Route, Routes, useParams } from 'react-router-dom'
import { RESULT_CATEGORY_LABELS } from '../../utils/resultsLibrary'
import { listItems } from '../api'
import CollectionList from '../components/CollectionList'
import { ChoiceField, FormSection, SelectField, TagsField, TextField, ToggleField } from '../components/fields'
import MediaPicker from '../components/MediaPicker'
import RecordEditor from '../components/RecordEditor'

const CATEGORY_OPTIONS = Object.entries(RESULT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
const KIND_OPTIONS = [
  { value: 'client', label: 'Client result', hint: 'A real Team JD client. Shown as a genuine outcome.' },
  { value: 'representative', label: 'Representative image', hint: 'A stock or example photo, labelled as not a client outcome.' },
]

const FILTERS = [
  { key: 'category', label: 'Category', anyLabel: 'Any category', options: CATEGORY_OPTIONS, match: (row, value) => row.category === value },
  {
    key: 'kind',
    label: 'Type',
    anyLabel: 'Any type',
    options: KIND_OPTIONS.map(({ value, label }) => ({ value, label })),
    match: (row, value) => row.kind === value,
  },
]

const COLUMNS = [
  { key: 'category', label: 'Category', render: (row) => RESULT_CATEGORY_LABELS[row.category] },
  { key: 'kind', label: 'Type', render: (row) => (row.kind === 'client' ? 'Client' : 'Representative') },
]

const NUDGE = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }
const clamp = (value) => Math.min(100, Math.max(0, Math.round(value)))

// How far the photo sits in from each edge of its frame, as fractions, when it
// is shown whole (object-fit: contain) and so may have bars at the sides.
function letterbox(img) {
  const imageRatio = img.naturalWidth / img.naturalHeight
  const frameRatio = img.clientWidth / img.clientHeight
  return imageRatio > frameRatio
    ? { x: 0, y: (1 - frameRatio / imageRatio) / 2 }
    : { x: (1 - imageRatio / frameRatio) / 2, y: 0 }
}

// Where the photo sits inside its frame when it is cropped to fill it. Click the
// photo, or use the arrow keys, to move the point that always stays in view.
function FocusPicker({ src, presentation, onChange }) {
  const [inset, setInset] = useState({ x: 0, y: 0 })
  const fill = presentation?.fit === 'cover'
  const focus = presentation?.focus || { x: 50, y: 50 }
  const set = (next) => onChange({ fit: fill ? 'cover' : 'contain', focus, ...next })

  const pick = (event) => {
    if (event.detail === 0) return // Enter or Space: the arrow keys do this instead
    const box = event.currentTarget.getBoundingClientRect()
    const across = (event.clientX - box.left) / box.width
    const down = (event.clientY - box.top) / box.height
    set({ focus: {
      x: clamp(((across - inset.x) / (1 - 2 * inset.x)) * 100),
      y: clamp(((down - inset.y) / (1 - 2 * inset.y)) * 100),
    } })
  }

  const nudge = (event) => {
    const step = NUDGE[event.key]
    if (!step) return
    event.preventDefault()
    set({ focus: { x: clamp(focus.x + step[0]), y: clamp(focus.y + step[1]) } })
  }

  const dot = {
    left: `${(inset.x + (focus.x / 100) * (1 - 2 * inset.x)) * 100}%`,
    top: `${(inset.y + (focus.y / 100) * (1 - 2 * inset.y)) * 100}%`,
  }

  return (
    <div className="jd-photo-field">
      <div className="jd-photo-frame">
        {src ? (
          <button type="button" className="jd-photo-pick" onClick={fill ? pick : undefined} onKeyDown={fill ? nudge : undefined} disabled={!fill}
            aria-label={fill ? `Point that stays in view: ${focus.x}% across, ${focus.y}% down. Click the photo or use the arrow keys to move it.` : 'Photo'}>
            <img src={src} alt="" onLoad={(event) => setInset(letterbox(event.currentTarget))} />
            {fill && <span className="jd-focus-dot" style={dot} aria-hidden="true" />}
          </button>
        ) : (
          <p className="jd-photo-missing">No photo yet.</p>
        )}
      </div>
      <ToggleField
        label="Fill the frame"
        hint={fill ? 'Click the photo, or use the arrow keys, to choose the part that always stays in view.' : 'Off: the whole photo shows, with space around it if needed.'}
        checked={fill}
        onChange={(checked) => set({ fit: checked ? 'cover' : 'contain' })}
      />
    </div>
  )
}

function ResultFields({ draft, update, errors, testimonials }) {
  const [picking, setPicking] = useState(false)
  return (
    <>
      <FormSection title="Photo" description="The image people see on the Results page and in the result's story.">
        <div className="jd-spot-actions">
          <button type="button" className="jd-admin-button jd-admin-button--sm" onClick={() => setPicking(true)}>
            {draft.image.src ? 'Change photo' : 'Choose photo'}
          </button>
        </div>
        {picking && (
          <MediaPicker
            kind="image"
            title="Choose a photo for this result"
            currentId={draft.image.assetId}
            onClose={() => setPicking(false)}
            onPick={(asset) => {
              setPicking(false)
              update({ image: { assetId: asset.id, src: asset.url }, alt: draft.alt || asset.alt })
            }}
          />
        )}
        <FocusPicker
          src={draft.image.src}
          presentation={draft.presentation}
          onChange={(presentation) => update({ presentation })}
        />
        {errors.image && <p className="jd-field-error">{errors.image}</p>}
        <TextField
          label="Photo description"
          required
          hint="What the photo shows, for people using screen readers. For example: Client on stage holding a gold medal."
          value={draft.alt}
          maxLength={300}
          error={errors.alt}
          onChange={(alt) => update({ alt })}
        />
      </FormSection>

      <FormSection title="Result">
        <TextField label="Caption" required hint="Short line under the photo." value={draft.caption} maxLength={160}
          error={errors.caption} onChange={(caption) => update({ caption })} />
        <TextField label="Headline" hint="Shown when someone opens the result." value={draft.name} maxLength={160}
          onChange={(name) => update({ name })} />
        <SelectField label="Category" value={draft.category} options={CATEGORY_OPTIONS} onChange={(category) => update({ category })} />
        <ChoiceField label="Type" value={draft.kind} options={KIND_OPTIONS} onChange={(kind) => update({ kind })} />
        <ToggleField label="Show on the About page" hint="Featured results appear in the About page's client results." checked={draft.featured}
          onChange={(featured) => update({ featured })} />
      </FormSection>

      <FormSection title="Story" description="Optional detail shown when the result is opened.">
        <div className="jd-field-row">
          <TextField label="Service" hint="For example: Competition Preparation" value={draft.location} maxLength={120}
            onChange={(location) => update({ location })} />
          <TextField label="Length" hint="For example: 16 weeks" value={draft.duration} maxLength={60}
            onChange={(duration) => update({ duration })} />
        </div>
        <TextField label="What happened" multiline rows={5} value={draft.summary} maxLength={1200}
          onChange={(summary) => update({ summary })} />
        <SelectField
          label="Testimonial"
          hint="Add or edit quotes in Testimonials."
          value={draft.testimonialId || ''}
          options={[{ value: '', label: 'None' }, ...testimonials.map((item) => ({ value: item.id, label: `${item.title}: ${item.subtitle}` }))]}
          onChange={(testimonialId) => update({ testimonialId: testimonialId || null })}
        />
        <TagsField label="Search words" hint="Separate with commas. Helps people find this with the Results page search."
          value={draft.tags} onChange={(tags) => update({ tags })} />
      </FormSection>
    </>
  )
}

function ResultEditor() {
  const { id } = useParams()
  const [testimonials, setTestimonials] = useState([])

  useEffect(() => {
    listItems('testimonials').then(setTestimonials).catch(() => setTestimonials([]))
  }, [])

  return (
    <RecordEditor
      collection="results"
      id={id}
      backTo="/admin/results"
      backLabel="Results"
      noun="result"
      titleOf={(draft) => draft.name || draft.caption || 'New result'}
      previewPath={(draft, record) => `/results?view=${encodeURIComponent(record.id)}`}
      previewNote="The Results page with this result open."
      renderFields={(props) => <ResultFields {...props} testimonials={testimonials} />}
    />
  )
}

export default function ResultsSection() {
  return (
    <Routes>
      <Route
        index
        element={(
          <CollectionList
            collection="results"
            title="Results"
            description="Your clients' results. Live ones appear on the Results page, and featured ones on About and Home."
            noun="result"
            newDraft={{ kind: 'client', category: 'competition' }}
            columns={COLUMNS}
            filters={FILTERS}
            emptyText="No results yet. Add your first client result."
            reorderHint="The order here is the order on the site."
          />
        )}
      />
      <Route path=":id" element={<ResultEditor />} />
    </Routes>
  )
}
