import { useRef, useState } from 'react'
import { Route, Routes, useParams } from 'react-router-dom'
import { RESULT_CATEGORY_LABELS } from '../../utils/resultsLibrary'
import CollectionList from '../components/CollectionList'
import { ChoiceField, FormSection, SelectField, TagsField, TextField, ToggleField } from '../components/fields'
import ImageFramer, { DEFAULT_FRAMING } from '../components/ImageFramer'
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

const NO_TESTIMONIAL = { quote: '', author: '', service: '', result: '' }

// Every live result is on the Results page and in the Home page gallery; About
// shows only featured client results (pages/About.jsx).
const resultPlaces = (draft) => [
  'the Results page',
  'the Home page gallery',
  ...(draft.kind === 'client' && draft.featured ? ['the About page'] : []),
]

// On the Results page each photo sits in a square. "Fill the frame" crops it to
// the square (Jake drags and zooms to choose the crop); off, the whole photo shows.
function PhotoFraming({ draft, update }) {
  const fill = draft.presentation?.fit === 'cover'
  const framing = { focus: draft.presentation?.focus, zoom: draft.presentation?.zoom }
  if (!draft.image.src) return <p className="jd-photo-missing">No photo yet.</p>

  return (
    <div className="jd-photo-field">
      <ToggleField
        label="Fill the frame"
        hint={fill ? 'The photo fills its square on the Results page. Drag it and zoom to crop it.' : 'Off: the whole photo shows, with space around it if needed.'}
        checked={fill}
        onChange={(checked) => update({ presentation: { ...DEFAULT_FRAMING, ...draft.presentation, fit: checked ? 'cover' : 'contain' } })}
      />
      {fill ? (
        <ImageFramer src={draft.image.src} aspect="1 / 1" label="Result photo" value={framing}
          onChange={(next) => update({ presentation: { fit: 'cover', ...next } })} />
      ) : (
        <div className="jd-photo-frame"><img src={draft.image.src} alt="" /></div>
      )}
    </div>
  )
}

// A quote from the client, shown inside the result's story. Switching it off
// and on again in the same visit brings back what was typed.
function TestimonialFields({ draft, update, errors }) {
  const kept = useRef(draft.testimonial)
  const testimonial = draft.testimonial
  const set = (patch) => update({ testimonial: { ...testimonial, ...patch } })

  return (
    <FormSection title="Testimonial" description="A quote from this client, shown when someone opens the result.">
      <ToggleField
        label="Add a testimonial"
        checked={Boolean(testimonial)}
        onChange={(on) => {
          if (!on) kept.current = testimonial
          update({ testimonial: on ? kept.current || NO_TESTIMONIAL : null })
        }}
      />
      {testimonial && (
        <>
          <TextField label="Quote" required multiline rows={4} value={testimonial.quote} maxLength={1200}
            error={errors['testimonial.quote']} onChange={(quote) => set({ quote })} />
          <TextField label="From" required hint="A first name, or something like Competition client." value={testimonial.author}
            maxLength={120} error={errors['testimonial.author']} onChange={(author) => set({ author })} />
          <div className="jd-field-row">
            <TextField label="Service" hint="For example: Posing" value={testimonial.service} maxLength={120}
              onChange={(service) => set({ service })} />
            <TextField label="Outcome" hint="For example: First show, top 3" value={testimonial.result} maxLength={120}
              onChange={(result) => set({ result })} />
          </div>
        </>
      )}
    </FormSection>
  )
}

function ResultFields({ draft, update, errors }) {
  const [picking, setPicking] = useState(false)
  return (
    <>
      <p className="jd-form-note">
        Fields marked <span className="jd-required-tag">Required</span> must be filled in before this result can go live.
      </p>
      <FormSection title="Photo" required description="The image people see on the Results page and in the result's story.">
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
        <PhotoFraming draft={draft} update={update} />
        {errors.image && <p className="jd-field-error" role="alert">{errors.image}</p>}
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
        {draft.kind === 'client' ? (
          <ToggleField label="Feature on the About page" hint="Also shows this result in the About page's client results." checked={draft.featured}
            onChange={(featured) => update({ featured })} />
        ) : (
          <p className="jd-field-hint">Only client results can be featured on the About page.</p>
        )}
      </FormSection>

      <TestimonialFields draft={draft} update={update} errors={errors} />

      <FormSection title="Story" description="Optional detail shown when the result is opened.">
        <div className="jd-field-row">
          <TextField label="Service" hint="For example: Competition Preparation" value={draft.location} maxLength={120}
            onChange={(location) => update({ location })} />
          <TextField label="Length" hint="For example: 16 weeks" value={draft.duration} maxLength={60}
            onChange={(duration) => update({ duration })} />
        </div>
        <TextField label="What happened" multiline rows={5} value={draft.summary} maxLength={1200}
          onChange={(summary) => update({ summary })} />
        <TagsField label="Search words" hint="Separate with commas. Helps people find this with the Results page search."
          value={draft.tags} onChange={(tags) => update({ tags })} />
      </FormSection>
    </>
  )
}

function ResultEditor() {
  const { id } = useParams()
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
      siteLocation={resultPlaces}
      renderFields={(props) => <ResultFields {...props} />}
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
            description="Your clients' results. Results that are on the site show on the Results page and in the Home page gallery. Featured client results also show on About."
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
