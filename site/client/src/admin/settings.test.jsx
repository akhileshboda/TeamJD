import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SettingsSection from './sections/SettingsSection'
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

function renderSettings(fetchMock) {
  vi.stubGlobal('fetch', fetchMock)
  return render(<MemoryRouter><SettingsSection /></MemoryRouter>)
}

const card = (name) => screen.getByRole('heading', { name }).closest('form')

describe('settings', () => {
  it('saves contact details straight away and says they are live', async () => {
    const fetchMock = vi.fn((url, init = {}) => {
      if (init.method === 'PUT') {
        expect(url).toBe('/api/admin/settings/contact')
        return json(view({ contact: JSON.parse(init.body) }))
      }
      return json(view())
    })
    renderSettings(fetchMock)
    await screen.findByRole('heading', { name: 'Contact and social links' })
    const contact = card('Contact and social links')
    fireEvent.change(within(contact).getByLabelText(/Instagram name/), { target: { value: 'newname' } })
    fireEvent.click(within(contact).getByRole('button', { name: 'Save' }))
    expect(await within(contact).findByText('Saved. This is live on the site now.')).toBeInTheDocument()
  })

  it('asks before putting the site live, and before changing where enquiries go', async () => {
    const fetchMock = vi.fn((url, init = {}) => (init.method === 'PUT' ? json(view({ site: JSON.parse(init.body) })) : json(view())))
    renderSettings(fetchMock)
    await screen.findByRole('heading', { name: 'Site visibility' })

    const site = card('Site visibility')
    fireEvent.click(within(site).getByLabelText(/^The site/))
    fireEvent.click(within(site).getByRole('button', { name: 'Save' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Show your site to everyone?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(fetchMock).not.toHaveBeenCalledWith('/api/admin/settings/site', expect.anything())

    const enquiries = card('Where enquiries go')
    fireEvent.change(within(enquiries).getByLabelText(/Send enquiries to/), { target: { value: 'jake@team-jd.com.au' } })
    fireEvent.click(within(enquiries).getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('new enquiries will be sent to jake@team-jd.com.au')
  })

  it('saving one card keeps unsaved edits in the others', async () => {
    const fetchMock = vi.fn((url, init = {}) => (init.method === 'PUT' ? json(view({ site: JSON.parse(init.body) })) : json(view())))
    renderSettings(fetchMock)
    await screen.findByRole('heading', { name: 'Contact and social links' })

    const contact = card('Contact and social links')
    fireEvent.change(within(contact).getByLabelText(/Instagram name/), { target: { value: 'not-saved-yet' } })
    const site = card('Site visibility')
    fireEvent.click(within(site).getByLabelText(/^The "under construction" page/))
    fireEvent.click(within(site).getByRole('button', { name: 'Save' }))
    expect(await within(site).findByText('Saved. This is live on the site now.')).toBeInTheDocument()
    expect(within(contact).getByLabelText(/Instagram name/)).toHaveValue('not-saved-yet')
  })

  it('shows field errors from the server', async () => {
    const fetchMock = vi.fn((url, init = {}) => (init.method === 'PUT'
      ? json({ error: 'Some settings need attention.', fields: { facebookUrl: 'Paste the full link, starting with https://' } }, 422)
      : json(view())))
    renderSettings(fetchMock)
    await screen.findByRole('heading', { name: 'Contact and social links' })
    const contact = card('Contact and social links')
    fireEvent.change(within(contact).getByLabelText(/Facebook link/), { target: { value: 'facebook.com/x' } })
    fireEvent.click(within(contact).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(within(contact).getByText('Paste the full link, starting with https://')).toBeInTheDocument())
  })
})
