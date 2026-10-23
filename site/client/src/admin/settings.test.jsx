import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SettingsSection from './sections/SettingsSection'
import { ToastProvider } from './components/Toasts'
import { PAGE_META } from '../content/siteDefaults'

const DEFAULT_SEO = Object.fromEntries(Object.keys(PAGE_META).map((page) => [page, { title: '', description: '' }]))

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

function view(overrides = {}) {
  return {
    settings: {
      contact: { email: 'jake@team-jd.com.au', instagramUrl: 'https://www.instagram.com/jake/', instagramHandle: 'jake', facebookUrl: '' },
      seo: DEFAULT_SEO,
      enquiries: { sendTo: '' },
      site: { visibility: 'default' },
      ...overrides,
    },
    defaults: { enquiriesTo: 'akhil@example.com', maintenanceByEnv: true },
    siteIsLive: false,
    enquiriesGoTo: 'akhil@example.com',
    bookingLinks: [{ id: 'posing-only', name: 'Posing', bookingUrl: 'https://calendly.com/x', applicationUrl: null }],
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderSettings(fetchMock, path = '/admin/settings') {
  vi.stubGlobal('fetch', fetchMock)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes><Route path="/admin/settings/*" element={<SettingsSection />} /></Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

const menu = () => within(screen.getByRole('navigation', { name: 'Settings' }))
const openPage = (name) => fireEvent.click(menu().getByRole('link', { name: new RegExp(`^${name}`) }))
const panel = (name) => screen.getByRole('region', { name })

describe('settings', () => {
  it('lists every setting with what it is set to now, and opens the first one beside it', async () => {
    renderSettings(vi.fn(() => json(view())))
    await screen.findByRole('navigation', { name: 'Settings' })
    const links = menu().getAllByRole('link').map((link) => link.textContent)
    expect(links).toEqual([
      'Site visibilityUnder construction',
      'Contact and social linksjake@team-jd.com.au',
      'Where enquiries goEmailed to akhil@example.com',
      'Search listingsUsing the built-in wording',
      'Booking links1 services',
    ])
    expect(menu().getByRole('link', { name: /^Site visibility/ })).toHaveAttribute('aria-current', 'page')
    expect(panel('Site visibility')).toBeInTheDocument()
  })

  it('shows the save bar only once something changes, and saves with a message that fades', async () => {
    const fetchMock = vi.fn((url, init = {}) => {
      if (init.method === 'PUT') {
        expect(url).toBe('/api/admin/settings/contact')
        return json(view({ contact: JSON.parse(init.body) }))
      }
      return json(view())
    })
    renderSettings(fetchMock, '/admin/settings/contact')
    const contact = await screen.findByRole('region', { name: 'Contact and social links' })
    expect(within(contact).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    fireEvent.change(within(contact).getByLabelText(/Instagram name/), { target: { value: 'newname' } })
    expect(menu().getByText('Unsaved')).toBeInTheDocument()
    fireEvent.click(within(contact).getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Saved. Your new details are live.')
    expect(within(contact).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('keeps unsaved edits while moving between settings, and can discard them', async () => {
    renderSettings(vi.fn(() => json(view())), '/admin/settings/contact')
    const contact = await screen.findByRole('region', { name: 'Contact and social links' })
    fireEvent.change(within(contact).getByLabelText(/Instagram name/), { target: { value: 'not-saved-yet' } })
    openPage('Where enquiries go')
    expect(panel('Where enquiries go')).toBeInTheDocument()
    openPage('Contact and social links')
    expect(within(panel('Contact and social links')).getByLabelText(/Instagram name/)).toHaveValue('not-saved-yet')
    fireEvent.click(within(panel('Contact and social links')).getByRole('button', { name: 'Discard changes' }))
    expect(within(panel('Contact and social links')).getByLabelText(/Instagram name/)).toHaveValue('jake')
  })

  it('asks before making the site live, and before changing where enquiries go', async () => {
    const fetchMock = vi.fn((url, init = {}) => (init.method === 'PUT' ? json(view({ site: JSON.parse(init.body) })) : json(view())))
    renderSettings(fetchMock)
    const site = await screen.findByRole('region', { name: 'Site visibility' })
    fireEvent.click(within(site).getByLabelText(/^Your site/))
    fireEvent.click(within(site).getByRole('button', { name: 'Save' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Make your site live?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(fetchMock).not.toHaveBeenCalledWith('/api/admin/settings/site', expect.anything())

    openPage('Where enquiries go')
    const enquiries = panel('Where enquiries go')
    fireEvent.change(within(enquiries).getByLabelText(/Send enquiries to/), { target: { value: 'jake@team-jd.com.au' } })
    fireEvent.click(within(enquiries).getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('new enquiries will be sent to jake@team-jd.com.au')
  })

  it('shows where enquiries go now, in plain words', async () => {
    renderSettings(vi.fn(() => json(view())), '/admin/settings/enquiries')
    const enquiries = await screen.findByRole('region', { name: 'Where enquiries go' })
    expect(within(enquiries).getByLabelText(/Send enquiries to/)).toHaveAttribute('placeholder', 'akhil@example.com')
    expect(enquiries).not.toHaveTextContent(/server/i)
  })

  it('marks the fields to fix when the server refuses a save, and keeps the error until closed', async () => {
    const fetchMock = vi.fn((url, init = {}) => (init.method === 'PUT'
      ? json({ error: 'Some settings need attention.', fields: { facebookUrl: 'Paste the full link, starting with https://' } }, 422)
      : json(view())))
    renderSettings(fetchMock, '/admin/settings/contact')
    const contact = await screen.findByRole('region', { name: 'Contact and social links' })
    fireEvent.change(within(contact).getByLabelText(/Facebook link/), { target: { value: 'facebook.com/x' } })
    fireEvent.click(within(contact).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(within(contact).getByText('Paste the full link, starting with https://')).toBeInTheDocument())
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Some settings need attention.')
    fireEvent.click(within(alert).getByRole('button', { name: 'Close message' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sends an unknown settings page back to the menu', async () => {
    renderSettings(vi.fn(() => json(view())), '/admin/settings/nope')
    expect(await screen.findByRole('navigation', { name: 'Settings' })).toBeInTheDocument()
    expect(panel('Site visibility')).toBeInTheDocument()
  })
})

describe('toasts', () => {
  it('fade a confirmation after a few seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const fetchMock = vi.fn((url, init = {}) => (init.method === 'PUT' ? json(view({ contact: JSON.parse(init.body) })) : json(view())))
      renderSettings(fetchMock, '/admin/settings/contact')
      const contact = await screen.findByRole('region', { name: 'Contact and social links' })
      fireEvent.change(within(contact).getByLabelText(/Instagram name/), { target: { value: 'x' } })
      fireEvent.click(within(contact).getByRole('button', { name: 'Save' }))
      expect(await screen.findByRole('status')).toBeInTheDocument()
      vi.advanceTimersByTime(5100)
      await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    } finally {
      vi.useRealTimers()
    }
  })
})
