import { useEffect, useId, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useParams, useResolvedPath } from 'react-router-dom'
import { PAGE_LABELS, PAGE_META } from '../../content/siteDefaults'
import { getSettings, saveSettings } from '../api'
import JourneyIcon from '../../components/JourneyIcon'
import { ChoiceField, TextField } from '../components/fields'
import { useToast } from '../components/Toasts'
import { ConfirmDialog } from '../components/ui'

const SITE_URL = 'team-jd.com.au'

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

function siteGoesLive(values, defaults) {
  return values.visibility === 'live' || (values.visibility === 'default' && !defaults.maintenanceByEnv)
}

// One entry per settings page, in menu order. `section` is the server's
// settings section it saves; `summary` is what the menu shows as set now.
// `confirm` returns a question to ask before a risky save, or null.
const PANELS = [
  {
    id: 'site',
    section: 'site',
    title: 'Site visibility',
    summary: (view) => (view.siteIsLive ? 'Live: everyone can see it' : 'Under construction'),
    description: 'Choose whether visitors see your site or the "under construction" page. While you are signed in you always see the real site.',
    saved: (view) => (view.siteIsLive ? 'Saved. Your site is live.' : 'Saved. Visitors now see the "under construction" page.'),
    confirm: (values, view) => {
      const goingLive = siteGoesLive(values, view.defaults)
      if (goingLive === view.siteIsLive) return null
      return goingLive
        ? { title: 'Make your site live?', label: 'Make the site live', tone: 'primary', body: 'Anyone who visits will see the full site straight away.' }
        : { title: 'Show the "under construction" page instead?', label: 'Hide the site', tone: 'danger', body: 'Visitors will only see the under construction page until you change this back.' }
    },
    fields: ({ values, setValues, view }) => (
      <ChoiceField
        label="What visitors see"
        value={values.visibility}
        onChange={(visibility) => setValues({ visibility })}
        options={[
          { value: 'live', label: 'Your site', hint: 'It is live and open to everyone.' },
          { value: 'maintenance', label: 'The "under construction" page', hint: 'Use this before launch, or while you rework things.' },
          { value: 'default', label: 'Follow the launch setting', hint: `Set when the site was installed. Currently: ${view.defaults.maintenanceByEnv ? 'under construction' : 'your site'}.` },
        ]}
      />
    ),
  },
  {
    id: 'contact',
    section: 'contact',
    title: 'Contact and social links',
    summary: (view) => view.settings.contact.email || 'No email address yet',
    description: 'Shown in the footer, on the Contact page and on the page-not-found screen.',
    saved: () => 'Saved. Your new details are live.',
    fields: ({ values, setValues, errors }) => (
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
    ),
  },
  {
    id: 'enquiries',
    section: 'enquiries',
    title: 'Where enquiries go',
    summary: (view) => (view.enquiriesGoTo ? `Emailed to ${view.enquiriesGoTo}` : 'Not being emailed anywhere yet'),
    description: 'Messages sent from the Contact page form are emailed to this address.',
    saved: (view) => (view.enquiriesGoTo ? `Saved. New enquiries go to ${view.enquiriesGoTo}.` : 'Saved.'),
    confirm: (values, view) => {
      const next = values.sendTo || view.defaults.enquiriesTo
      return {
        title: 'Change where enquiries go?',
        label: 'Change address',
        tone: 'primary',
        body: next ? `From now on, new enquiries will be sent to ${next}.` : 'New enquiries will not be emailed anywhere until you add an address.',
      }
    },
    fields: ({ values, setValues, errors, view }) => (
      <TextField label="Send enquiries to" type="email" value={values.sendTo} error={errors.sendTo} spellCheck={false}
        placeholder={view.enquiriesGoTo || 'name@example.com'} onChange={(sendTo) => setValues({ sendTo })}
        hint={view.settings.enquiries.sendTo && view.defaults.enquiriesTo
          ? `Clear this box to go back to ${view.defaults.enquiriesTo}.`
          : !view.enquiriesGoTo ? 'Add the address enquiries should go to.' : undefined} />
    ),
  },
  {
    id: 'search',
    section: 'seo',
    title: 'Search listings',
    summary: (view) => {
      const custom = Object.values(view.settings.seo).filter((entry) => entry.title || entry.description).length
      return custom ? `Your wording on ${custom} ${custom === 1 ? 'page' : 'pages'}` : 'Using the built-in wording'
    },
    description: 'How each page appears in Google and when a link to it is shared. Leave a box empty to keep the built-in wording shown in grey.',
    saved: () => 'Saved. Search engines pick up the new wording on their next visit.',
    wide: true,
    fields: ({ values, setValues }) => Object.keys(PAGE_META).map((page) => (
      <fieldset key={page} className="jd-seo-page">
        <legend className="jd-field-label">{PAGE_LABELS[page]}</legend>
        <div className="jd-seo-page-fields">
          <TextField label="Title" value={values[page].title} maxLength={70} placeholder={PAGE_META[page].title || 'Team JD | Jake Dedert Fitness Coaching'}
            onChange={(title) => setValues({ ...values, [page]: { ...values[page], title } })} />
          <TextField label="Description" multiline rows={2} value={values[page].description} maxLength={200}
            placeholder={PAGE_META[page].description}
            onChange={(description) => setValues({ ...values, [page]: { ...values[page], description } })} />
        </div>
        <SearchPreview page={page} entry={values[page]} />
      </fieldset>
    )),
  },
  {
    id: 'booking',
    title: 'Booking links',
    summary: (view) => `${view.bookingLinks.length} services`,
    description: 'Each service has its own booking link. Change them in Services & prices, where they go live when you publish the changes.',
    readOnly: ({ view }) => (
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
    ),
  },
]

function SettingsMenu({ view, active, base, isDirty }) {
  return (
    <nav className="jd-settings-menu" aria-label="Settings">
      <ul>
        {PANELS.map((panel) => (
          <li key={panel.id}>
            <Link to={`${base}/${panel.id}`} className="jd-settings-link" aria-current={panel.id === active ? 'page' : undefined}>
              <span className="jd-settings-link-text">
                <strong>{panel.title}</strong>
                <span>{panel.summary(view)}</span>
              </span>
              {panel.section && isDirty(panel.section) && <span className="jd-chip jd-chip--pending">Unsaved</span>}
              <JourneyIcon name="arrowRight" size={16} className="jd-settings-link-arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// One settings page. Its form keeps unsaved edits in the parent, so moving to
// another page and back loses nothing; the save bar appears only when there is
// something to save.
function SettingsPanel({ panel, view, base, values, errors, dirty, onChange, onDiscard, onSave }) {
  const [confirming, setConfirming] = useState(null)
  const [saving, setSaving] = useState(false)
  const formRef = useRef(null)
  const headingId = useId()

  const save = async () => {
    setSaving(true)
    const ok = await onSave()
    setSaving(false)
    setConfirming(null)
    if (!ok) requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
  }

  const requestSave = (event) => {
    event.preventDefault()
    const question = panel.confirm?.(values, view)
    if (question) setConfirming(question)
    else save()
  }

  return (
    <section className={`jd-settings-panel${panel.wide ? ' is-wide' : ''}`} aria-labelledby={headingId}>
      <Link className="jd-back jd-settings-back" to={base}>
        <JourneyIcon name="arrowLeft" size={16} />
        Settings
      </Link>
      <h2 id={headingId} className="jd-settings-panel-title">{panel.title}</h2>
      <p className="jd-settings-panel-lede">{panel.description}</p>
      {panel.readOnly ? panel.readOnly({ view }) : (
        <form ref={formRef} className="jd-settings-form" onSubmit={requestSave} noValidate>
          <div className="jd-settings-fields">{panel.fields({ values, setValues: onChange, errors, view })}</div>
          {dirty && (
            <div className="jd-save-bar" role="region" aria-label="Unsaved changes">
              <p>Unsaved changes</p>
              <div className="jd-save-bar-actions">
                <button type="button" className="jd-admin-button jd-admin-button--quiet" disabled={saving} onClick={onDiscard}>Discard changes</button>
                <button type="submit" className="jd-admin-button jd-admin-button--primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          )}
        </form>
      )}
      {confirming && (
        <ConfirmDialog title={confirming.title} confirmLabel={confirming.label} tone={confirming.tone} busy={saving}
          onConfirm={save} onCancel={() => setConfirming(null)}>
          <p>{confirming.body}</p>
        </ConfirmDialog>
      )}
    </section>
  )
}

// Settings apply as soon as they are saved; there is no publish step. On wide
// screens the menu and the chosen page sit side by side; on phones the menu is
// its own screen and each page has a way back.
export default function SettingsSection() {
  const base = useResolvedPath('.').pathname.replace(/\/$/, '')
  const toast = useToast()
  const [view, setView] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [drafts, setDrafts] = useState({})
  const [errors, setErrors] = useState({})

  useEffect(() => {
    getSettings().then(setView).catch((failure) => setLoadError(failure.message))
  }, [])

  const isDirty = (section) => section in drafts && JSON.stringify(drafts[section]) !== JSON.stringify(view.settings[section])
  const anyDirty = Boolean(view) && Object.keys(drafts).some(isDirty)

  useEffect(() => {
    if (!anyDirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [anyDirty])

  if (loadError) return <p className="jd-admin-error" role="alert">{loadError}</p>
  if (!view) return <div className="jd-skeleton jd-skeleton--list" role="status" aria-label="Loading settings" />

  const forget = (section) => {
    setDrafts(({ [section]: _dropped, ...rest }) => rest)
    setErrors(({ [section]: _dropped, ...rest }) => rest)
  }

  // Returns whether it saved, so the page can point at the fields to fix.
  const saveSection = async (panel) => {
    try {
      const next = await saveSettings(panel.section, drafts[panel.section])
      setView(next)
      forget(panel.section)
      toast({ scope: 'settings', tone: 'notice', text: panel.saved(next) })
      return true
    } catch (error) {
      setErrors((current) => ({ ...current, [panel.section]: error.fields || {} }))
      toast({ scope: 'settings', tone: 'error', text: error.message })
      return false
    }
  }

  // With no page chosen, phones show just the menu and wide screens show the
  // first page beside it.
  const page = (panelId) => {
    const panel = PANELS.find((item) => item.id === (panelId ?? PANELS[0].id))
    if (!panel) return <Navigate to={base} replace />
    return (
      <div className={`jd-settings${panelId ? ' is-panel' : ''}`}>
        <SettingsHead />
        <div className="jd-settings-layout">
          <SettingsMenu view={view} active={panel.id} base={base} isDirty={isDirty} />
          <SettingsPanel
            key={panel.id}
            panel={panel}
            view={view}
            base={base}
            values={drafts[panel.section] ?? view.settings[panel.section]}
            errors={errors[panel.section] || {}}
            dirty={Boolean(panel.section) && isDirty(panel.section)}
            onChange={(values) => setDrafts((current) => ({ ...current, [panel.section]: values }))}
            onDiscard={() => forget(panel.section)}
            onSave={() => saveSection(panel)}
          />
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route index element={page(null)} />
      <Route path=":panelId" element={<PanelRoute render={page} />} />
    </Routes>
  )
}

function SettingsHead() {
  return (
    <div className="jd-settings-head">
      <h1 className="jd-page-title">Settings</h1>
      <p className="jd-page-lede">Changes here apply as soon as you save them.</p>
    </div>
  )
}

function PanelRoute({ render }) {
  const { panelId } = useParams()
  return render(panelId)
}
