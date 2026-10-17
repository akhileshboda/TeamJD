import { Link, Route, Routes, useParams } from 'react-router-dom'
import CollectionList from '../components/CollectionList'
import { FormSection, TextField } from '../components/fields'
import RecordEditor from '../components/RecordEditor'

const COLUMNS = [{ key: 'result', label: 'Outcome', render: (row) => row.result || '–' }]

function TestimonialFields({ draft, update, errors }) {
  return (
    <FormSection title="Testimonial">
      <TextField label="Quote" required multiline rows={5} value={draft.quote} maxLength={1200} error={errors.quote}
        onChange={(quote) => update({ quote })} />
      <TextField label="From" required hint="A first name, or something like Competition client." value={draft.author}
        maxLength={120} error={errors.author} onChange={(author) => update({ author })} />
      <div className="jd-field-row">
        <TextField label="Service" hint="For example: Posing" value={draft.service} maxLength={120}
          onChange={(service) => update({ service })} />
        <TextField label="Outcome" hint="For example: First show, top 3" value={draft.result} maxLength={120}
          onChange={(result) => update({ result })} />
      </div>
    </FormSection>
  )
}

function UsagePanel({ record }) {
  return (
    <section className="jd-panel jd-usage">
      <h2 className="jd-panel-title">Where this appears</h2>
      {record.usage.length ? (
        <ul>
          {record.usage.map((use) => (
            <li key={use.id}>
              In the story of <Link to={`/admin/results/${use.id}`}>{use.title}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="jd-panel-empty">
          Nowhere yet. Testimonials appear inside a result: open a result and choose this one as its testimonial.
        </p>
      )}
    </section>
  )
}

function TestimonialEditor() {
  const { id } = useParams()
  return (
    <RecordEditor
      collection="testimonials"
      id={id}
      backTo="/admin/testimonials"
      backLabel="Testimonials"
      noun="testimonial"
      titleOf={(draft) => draft.author || 'New testimonial'}
      previewPath={(draft, record) => (record.usage[0] ? `/results?view=${encodeURIComponent(record.usage[0].id)}` : null)}
      previewNote="Shown inside the result it belongs to."
      renderFields={(props) => <TestimonialFields {...props} />}
      renderAside={({ record }) => <UsagePanel record={record} />}
    />
  )
}

export default function TestimonialsSection() {
  return (
    <Routes>
      <Route
        index
        element={(
          <CollectionList
            collection="testimonials"
            title="Testimonials"
            description="What clients say about working with you. Each one shows inside a result's story."
            noun="testimonial"
            newDraft={{}}
            columns={COLUMNS}
            emptyText="No testimonials yet. Add one, then link it to a result."
          />
        )}
      />
      <Route path=":id" element={<TestimonialEditor />} />
    </Routes>
  )
}
