import { useRef, useState } from 'react'
import { Route, Routes, useParams } from 'react-router-dom'
import { useContent } from '../../hooks/useContent'
import { RESULT_AUDIENCE_LABELS, RESULT_CATEGORY_LABELS, resultAudience } from '../../utils/resultsLibrary'
import CollectionList from '../components/CollectionList'
import { ChoiceField, FormSection, RequiredNote, SelectField, TagsField, TextField, ToggleField } from '../components/fields'
import ImageFramer, { DEFAULT_FRAMING } from '../components/ImageFramer'
import MediaPicker from '../components/MediaPicker'
import RecordEditor from '../components/RecordEditor'

const CATEGORY_OPTIONS = Object.entries(RESULT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
const AUDIENCE_HINTS = {
  competitor: 'Stage and posing results, for people preparing to compete.',
  transformation: 'Before and after or body-composition change, for people wanting to transform.',
  everyday: 'Strength, health and lifestyle wins, for people training for themselves.',
}
const AUDIENCE_OPTIONS = Object.entries(RESULT_AUDIENCE_LABELS).map(([value, label]) => ({ value, label, hint: AUDIENCE_HINTS[value] }))

const FILTERS = [
  {
    key: 'audience',
    label: 'Audience',
    anyLabel: 'Any audience',
    options: AUDIENCE_OPTIONS.map(({ value, label }) => ({ value, label })),
    match: (row, value) => resultAudience(row) === value,
  },
  { key: 'category', label: 'Category', anyLabel: 'Any category', options: CATEGORY_OPTIONS, match: (row, value) => row.category === value },
]

const COLUMNS = [
  { key: 'audience', label: 'Audience', render: (row) => RESULT_AUDIENCE_LABELS[resultAudience(row)] },
  { key: 'category', label: 'Category', render: (row) => RESULT_CATEGORY_LABELS[row.category] },
  { key: 'added', label: 'Added', render: (row) => formatAdded(row.createdAt) },
]

function formatAdded(createdAt) {
  const date = createdAt ? new Date(createdAt) : null
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
}

const NO_TESTIMONIAL = { quote: '', author: '', service: '', result: '' }

// Every live result is on the Results page and in the Home page gallery; About
// shows only featured client results (pages/About.jsx).
const resultPlaces = (draft) => [
  'the Results page',
  'the Home page gallery',
  ...(draft.featured ? ['the About page'] : []),
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

// The site's services, by id, so the story always shows the service's current name.
function useServiceOptions() {
  const { data: services } = useContent('services')
  return [
    { value: '', label: 'None' },
    ...(Array.isArray(services) ? services : []).map((service) => ({ value: service.id, label: service.name })),
  ]
}

function ResultFields({ draft, update, errors }) {
  const [picking, setPicking] = useState(false)
  const serviceOptions = useServiceOptions()
  return (
    <>
      <RequiredNote />
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
        <ChoiceField label="Who it's for" value={resultAudience(draft)} options={AUDIENCE_OPTIONS} onChange={(audience) => update({ audience })} />
        <SelectField label="Category" value={draft.category} options={CATEGORY_OPTIONS} onChange={(category) => update({ category })} />
        <ToggleField label="Feature on the About page" hint="Also shows this result in the About page's client results." checked={draft.featured}
          onChange={(featured) => update({ featured })} />
      </FormSection>

      <TestimonialFields draft={draft} update={update} errors={errors} />

      <FormSection title="Story" description="Optional detail shown when the result is opened.">
        <div className="jd-field-row">
          <SelectField label="Service" hint="One of your services. Shown when it adds to the category." value={draft.serviceId}
            options={serviceOptions} onChange={(serviceId) => update({ serviceId })} />
          <TextField label="Length" hint="For example: 16 weeks" value={draft.duration} maxLength={60}
            onChange={(duration) => update({ duration })} />
        </div>
        <TextField label="What happened" hint="Leave a blank line to start a new paragraph." multiline rows={5} value={draft.summary} maxLength={1200}
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
            description="Your clients' results. Results that are on the site show on the Results page and in the Home page gallery. Featured ones also show on About. Newest first, here and on the site."
            noun="result"
            newDraft={{ category: 'competition', audience: 'competitor', serviceId: 'competition-prep' }}
            columns={COLUMNS}
            filters={FILTERS}
            emptyText="No results yet. Add your first client result."
            reorderable={false}
          />
        )}
      />
      <Route path=":id" element={<ResultEditor />} />
    </Routes>
  )
}
