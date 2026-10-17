import { Link, Route, Routes, useParams } from 'react-router-dom'
import CollectionList from '../components/CollectionList'
import { ChoiceField, FormSection, ListField, RowsField, TextField } from '../components/fields'
import RecordEditor from '../components/RecordEditor'

const COLUMNS = [{ key: 'price', label: 'Price', render: (row) => row.price }]

const PRICING_OPTIONS = [
  { value: 'priced', label: 'Show prices', hint: 'People see your prices before they book.' },
  { value: 'consultation', label: 'Price set after a consultation', hint: 'The page invites people to talk first.' },
]

function ServiceFields({ draft, update, errors, record }) {
  const set = (key) => (value) => update({ [key]: value })
  const setPricing = (patch) => update({ pricing: { ...draft.pricing, ...patch } })

  return (
    <>
      <FormSection title="Service card" description="Shown in the menu, on the Services page and on Home.">
        <TextField label="Name" required value={draft.name} maxLength={60} error={errors.name} onChange={set('name')} />
        <TextField label="Tagline" required value={draft.tagline} maxLength={200} error={errors.tagline} onChange={set('tagline')} />
        <TextField label="Short description" required multiline rows={3} value={draft.short_description} maxLength={400}
          error={errors.short_description} onChange={set('short_description')} hint="Also used in Google search results." />
      </FormSection>

      <FormSection title="Booking" description="Where the booking buttons on this page go.">
        <div className="jd-field-row">
          <TextField label="Button text" required value={draft.cta_text} maxLength={60} error={errors.cta_text} onChange={set('cta_text')} />
          <TextField label="Booking link" required value={draft.cta_url} maxLength={500} error={errors.cta_url}
            onChange={set('cta_url')} hint="Your Calendly link." type="url" spellCheck={false} />
        </div>
        {draft.application_required && (
          <div className="jd-field-row">
            <TextField label="Application button text" value={draft.application_cta_text} maxLength={60}
              onChange={set('application_cta_text')} />
            <TextField label="Application form link" required value={draft.application_url} maxLength={500}
              error={errors.application_url} onChange={set('application_url')} hint="Your Typeform link." type="url" spellCheck={false} />
          </div>
        )}
      </FormSection>

      <FormSection title="Prices">
        <ChoiceField label="How prices are shown" value={draft.pricing.mode} options={PRICING_OPTIONS} onChange={(mode) => setPricing({ mode })} />
        {draft.pricing.mode === 'priced' && (
          <RowsField
            label="Prices"
            rows={draft.pricing.tiers}
            noun="price"
            maxRows={6}
            columns={[
              { key: 'label', label: 'Option', maxLength: 80, hint: 'For example: Solo sessions' },
              { key: 'price', label: 'Price', maxLength: 20, hint: 'For example: $85' },
              { key: 'unit', label: 'Per', maxLength: 60, hint: 'For example: per session' },
            ]}
            onChange={(tiers) => setPricing({ tiers })}
          />
        )}
        {errors.pricing && <p className="jd-field-error">{errors.pricing}</p>}
      </FormSection>

      <FormSection title="About this service">
        <TextField label="Introduction" multiline rows={6} value={draft.description} maxLength={3000} onChange={set('description')} />
        <RowsField
          label="Quick facts"
          hint="Short facts shown near the top of the page."
          rows={draft.facts}
          noun="fact"
          columns={[
            { key: 'label', label: 'Label', maxLength: 40 },
            { key: 'value', label: 'Value', maxLength: 120 },
            { key: 'url', label: 'Link (optional)', maxLength: 500 },
          ]}
          errors={errors}
          errorPrefix="facts"
          onChange={set('facts')}
        />
      </FormSection>

      <FormSection title="What to expect">
        <TextField label="Heading" value={draft.expectation_title} maxLength={160} onChange={set('expectation_title')} />
        <TextField label="Introduction" multiline rows={3} value={draft.expectation_lede} maxLength={600} onChange={set('expectation_lede')} />
        <ListField label="Steps" items={draft.expectations} noun="step" multiline maxLength={400} onChange={set('expectations')} />
      </FormSection>

      <FormSection title="Who it's for">
        <ListField label="Points" items={draft.who_its_for} noun="point" maxLength={300} onChange={set('who_its_for')} />
      </FormSection>

      <FormSection title="What's included">
        <RowsField
          label="Included"
          rows={draft.includes}
          noun="item"
          fixed
          columns={[
            { key: 'title', label: 'Title', maxLength: 120 },
            { key: 'description', label: 'Description', maxLength: 600, multiline: true },
          ]}
          onChange={set('includes')}
        />
      </FormSection>

      {draft.venue && (
        <FormSection title="Venue">
          <TextField label="Venue name" value={draft.venue.name} maxLength={120} onChange={(name) => update({ venue: { ...draft.venue, name } })} />
          <TextField label="Address" value={draft.venue.address} maxLength={200} onChange={(address) => update({ venue: { ...draft.venue, address } })} />
          <TextField label="Description" multiline rows={3} value={draft.venue.description} maxLength={800}
            onChange={(description) => update({ venue: { ...draft.venue, description } })} />
          <RowsField
            label="Venue photo descriptions"
            rows={draft.venue.images}
            noun="photo"
            fixed
            columns={[{ key: 'alt', label: 'Description', maxLength: 300 }]}
            onChange={(images) => update({ venue: { ...draft.venue, images } })}
          />
        </FormSection>
      )}

      {draft.federations && (
        <FormSection title="Federations">
          <ListField label="Federations you coach for" items={draft.federations} noun="federation" maxItems={10} maxLength={60}
            onChange={set('federations')} />
        </FormSection>
      )}

      <FormSection title="Photo descriptions" description="What the main photos show, for people using screen readers.">
        <p className="jd-field-hint">
          To change the photos themselves, go to <Link className="jd-inline-link" to={`/admin/pages/${record.draft.slug}`}>Pages: {draft.name}</Link>.
        </p>
        <TextField label="Main photo" value={draft.hero_alt} maxLength={300} onChange={set('hero_alt')} />
        <TextField label="Supporting photo" value={draft.body_alt} maxLength={300} onChange={set('body_alt')} />
      </FormSection>
    </>
  )
}

function ServiceEditor() {
  const { id } = useParams()
  return (
    <RecordEditor
      collection="services"
      id={id}
      backTo="/admin/services"
      backLabel="Services & prices"
      noun="service"
      titleOf={(draft) => draft.name || 'Service'}
      previewPath={(draft) => `/services/${draft.slug}`}
      previewNote="This service's page with your changes."
      canHide={false}
      canDelete={false}
      renderFields={(props) => <ServiceFields {...props} />}
    />
  )
}

export default function ServicesSection() {
  return (
    <Routes>
      <Route
        index
        element={(
          <CollectionList
            collection="services"
            title="Services & prices"
            description="Your four services: what each includes, its prices and where people book."
            noun="service"
            columns={COLUMNS}
            canHide={false}
            canDelete={false}
            emptyText="No services found."
            reorderHint="This is the order services appear in the menu and on the Services page."
          />
        )}
      />
      <Route path=":id" element={<ServiceEditor />} />
    </Routes>
  )
}
