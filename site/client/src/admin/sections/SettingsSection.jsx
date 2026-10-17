import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PAGE_LABELS, PAGE_META } from '../../content/siteDefaults'
import { getSettings, saveSettings } from '../api'
import { ChoiceField, FormSection, TextField } from '../components/fields'
import { ConfirmDialog } from '../components/ui'

const SITE_URL = 'team-jd.com.au'

// One card of settings with its own Save. Settings apply as soon as they are
// saved; `confirm` describes the change before risky ones go through.
function SettingsCard({ title, description, initial, section, onSaved, confirm, children }) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(null)
  const formRef = useRef(null)
  // Saving any card hands every card a fresh `initial` object; only reset when
  // this card's saved values really changed, so other cards keep their edits.
  const initialKey = JSON.stringify(initial)
  const changed = JSON.stringify(values) !== initialKey

  useEffect(() => {
    setValues(JSON.parse(initialKey))
  }, [initialKey])

  useEffect(() => {
    if (!changed) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changed])

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      onSaved(await saveSettings(section, values))
      setErrors({})
      setMessage({ tone: 'notice', text: 'Saved. This is live on the site now.' })
    } catch (error) {
      setErrors(error.fields || {})
      setMessage({ tone: 'error', text: error.message })
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
    } finally {
      setBusy(false)
      setConfirming(null)
    }
  }

  const requestSave = (event) => {
    event.preventDefault()
    const question = confirm?.(values)
    if (question) setConfirming(question)
    else save()
  }

  return (
    <form ref={formRef} className="jd-form-section jd-settings-card" onSubmit={requestSave} noValidate>
      <div className="jd-form-section-head">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="jd-form-section-body">
        {children({ values, setValues, errors })}
        {message && <p className={message.tone === 'error' ? 'jd-admin-error' : 'jd-admin-notice'} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p>}
        <div>
          <button type="submit" className="jd-admin-button jd-admin-button--primary" disabled={busy || !changed}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog title={confirming.title} confirmLabel={confirming.label} tone={confirming.tone} busy={busy}
          onConfirm={save} onCancel={() => setConfirming(null)}>
          <p>{confirming.body}</p>
        </ConfirmDialog>
      )}
    </form>
  )
}

function SearchPreview({ page, entry }) {
  const meta = PAGE_META[page]
  const title = entry.title || meta.title
  const fullTitle = title ? `${title} | Team JD` : 'Team JD | Jake Dedert Fitness Coaching'
  return (
    <div className="jd-search-preview" aria-hidden="true">
      <span className="jd-search-preview-url">{SITE_URL}{page === 'home' ? '' : ` › ${page}`}</span>
      <span className="jd-search-preview-title">{fullTitle}</span>
      <span className="jd-search-preview-text">{entry.description || meta.description}</span>
    </div>
  )
}

export default function SettingsSection() {
  const [view, setView] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getSettings().then(setView).catch((failure) => setError(failure.message))
  }, [])

  if (error) return <p className="jd-admin-error" role="alert">{error}</p>
  if (!view) return <div className="jd-skeleton jd-skeleton--list" role="status" aria-label="Loading settings" />

  const { settings, defaults } = view

  return (
    <div className="jd-settings">
      <div className="jd-list-head">
        <div>
          <h1 className="jd-page-title">Settings</h1>
          <p className="jd-page-lede">Settings apply as soon as you save them. There is no draft step here.</p>
        </div>
      </div>

      <SettingsCard
        title="Site visibility"
        description={view.siteIsLive ? 'Visitors can see your site.' : 'Visitors see the "under construction" page. You still see the real site while signed in.'}
        section="site"
        initial={settings.site}
        onSaved={setView}
        confirm={(values) => {
          const goingLive = values.visibility === 'live' || (values.visibility === 'default' && !defaults.maintenanceByEnv)
          return goingLive === view.siteIsLive ? null : goingLive
            ? { title: 'Show your site to everyone?', label: 'Make the site live', tone: 'primary', body: 'Anyone who visits will see the full site straight away.' }
            : { title: 'Hide your site behind the "under construction" page?', label: 'Hide the site', tone: 'danger', body: 'Visitors will only see the under construction page until you change this back.' }
        }}
      >
        {({ values, setValues }) => (
          <ChoiceField
            label="What visitors see"
            value={values.visibility}
            onChange={(visibility) => setValues({ visibility })}
            options={[
              { value: 'live', label: 'The site', hint: 'Your site is open to everyone.' },
              { value: 'maintenance', label: 'The "under construction" page', hint: 'Use this before launch, or while you rework things.' },
              { value: 'default', label: 'Follow the server setting', hint: `Currently: ${defaults.maintenanceByEnv ? 'under construction' : 'the site'}.` },
            ]}
          />
        )}
      </SettingsCard>

      <SettingsCard
        title="Contact and social links"
        description="Shown in the footer, on the Contact page and on the page-not-found screen."
        section="contact"
        initial={settings.contact}
        onSaved={setView}
      >
        {({ values, setValues, errors }) => (
          <>
            <TextField label="Email address" type="email" value={values.email} error={errors.email} spellCheck={false}
              onChange={(email) => setValues({ ...values, email })} hint="Shown on the Privacy page for questions about personal information." />
            <div className="jd-field-row">
              <TextField label="Instagram link" type="url" value={values.instagramUrl} error={errors.instagramUrl} spellCheck={false}
                onChange={(instagramUrl) => setValues({ ...values, instagramUrl })} hint="Leave empty to hide Instagram links." />
              <TextField label="Instagram name" value={values.instagramHandle} spellCheck={false}
                onChange={(instagramHandle) => setValues({ ...values, instagramHandle })} hint="Shown as @name on the Contact page." />
            </div>
            <TextField label="Facebook link" type="url" value={values.facebookUrl} error={errors.facebookUrl} spellCheck={false}
              onChange={(facebookUrl) => setValues({ ...values, facebookUrl })} hint="Leave empty to hide Facebook links." />
          </>
        )}
      </SettingsCard>

      <SettingsCard
        title="Where enquiries go"
        description="Messages from the Contact page form are emailed here."
        section="enquiries"
        initial={settings.enquiries}
        onSaved={setView}
        confirm={(values) => ({
          title: 'Change where enquiries go?',
          label: 'Change address',
          tone: 'primary',
          body: `From now on, new enquiries will be sent to ${values.sendTo || defaults.enquiriesTo || 'the address set on the server'}.`,
        })}
      >
        {({ values, setValues, errors }) => (
          <TextField label="Send enquiries to" type="email" value={values.sendTo} error={errors.sendTo} spellCheck={false}
            placeholder={defaults.enquiriesTo} onChange={(sendTo) => setValues({ sendTo })}
            hint={`Currently going to ${view.enquiriesGoTo || 'nobody: email is not set up on this server'}. Leave empty to use the server's address.`} />
        )}
      </SettingsCard>

      <SettingsCard
        title="Search listings"
        description="How each page appears in Google and when a link is shared. Leave a field empty to keep the built-in wording shown in grey."
        section="seo"
        initial={settings.seo}
        onSaved={setView}
      >
        {({ values, setValues }) => Object.keys(PAGE_META).map((page) => (
          <fieldset key={page} className="jd-seo-page">
            <legend className="jd-field-label">{PAGE_LABELS[page]}</legend>
            <TextField label="Title" value={values[page].title} maxLength={70} placeholder={PAGE_META[page].title || 'Team JD | Jake Dedert Fitness Coaching'}
              onChange={(title) => setValues({ ...values, [page]: { ...values[page], title } })} />
            <TextField label="Description" multiline rows={2} value={values[page].description} maxLength={200}
              placeholder={PAGE_META[page].description}
              onChange={(description) => setValues({ ...values, [page]: { ...values[page], description } })} />
            <SearchPreview page={page} entry={values[page]} />
          </fieldset>
        ))}
      </SettingsCard>

      <section className="jd-form-section">
        <div className="jd-form-section-head">
          <h2>Booking links</h2>
          <p>Each service has its own booking link. Change them in Services & prices, where they go live when you publish.</p>
        </div>
        <ul className="jd-booking-links">
          {view.bookingLinks.map((link) => (
            <li key={link.id}>
              <span>
                <strong>{link.name}</strong>
                <a href={link.bookingUrl} target="_blank" rel="noreferrer">{link.bookingUrl}</a>
                {link.applicationUrl && <a href={link.applicationUrl} target="_blank" rel="noreferrer">Application: {link.applicationUrl}</a>}
              </span>
              <Link className="jd-admin-button jd-admin-button--sm" to={`/admin/services/${link.id}`}>Edit</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
