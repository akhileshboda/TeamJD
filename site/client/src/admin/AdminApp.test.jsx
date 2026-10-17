import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminApp from './AdminApp'
import { SECTIONS } from './sections'

vi.mock('./pages/HomeStats', () => ({ default: () => <h1>Stats home</h1> }))

function json(body, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

function renderAt(path, routes) {
  vi.stubGlobal('fetch', vi.fn((url, init = {}) => routes(url, init)))
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('dashboard sign-in', () => {
  it('asks for an email, then the code, then opens the dashboard', async () => {
    renderAt('/admin', (url, init) => {
      if (url === '/api/admin/auth/session') return json({ signedIn: false, email: null })
      if (url === '/api/admin/auth/code') return json({ ok: true })
      if (url === '/api/admin/auth/verify') {
        const body = JSON.parse(init.body)
        return body.code === '123456' ? json({ email: body.email }) : json({ error: 'That code is not right.' }, 401)
      }
      return json({}, 404)
    })

    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'jake@team-jd.com.au' } })
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))

    const code = await screen.findByLabelText('6-digit code')
    fireEvent.change(code, { target: { value: '999999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not right.')

    fireEvent.change(code, { target: { value: '12a3456' } })
    expect(code).toHaveValue('123456')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Stats home' })).toBeInTheDocument()
    expect(screen.getByText('jake@team-jd.com.au')).toBeInTheDocument()
  })
})

describe('dashboard shell', () => {
  const signedIn = (url) => (url === '/api/admin/auth/session'
    ? json({ signedIn: true, email: 'akhil@example.com' })
    : json({}, 404))

  it('builds the sidebar from the section registry, grouped', async () => {
    renderAt('/admin', signedIn)
    const nav = await screen.findByRole('navigation', { name: 'Dashboard' })
    const links = within(nav).getAllByRole('link').map((link) => link.textContent)
    expect(links).toEqual(SECTIONS.map((section) => section.label))
    expect(within(nav).getByText('Content')).toBeInTheDocument()
    expect(within(nav).getByText('Site')).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  })

  it('deep links open their section', async () => {
    renderAt('/admin/testimonials', (url) => (url === '/api/admin/collections/testimonials'
      ? json({ items: [] })
      : signedIn(url)))
    expect(await screen.findByRole('heading', { name: 'Testimonials' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Dashboard' })
    expect(within(nav).getByRole('link', { name: 'Testimonials' })).toHaveAttribute('aria-current', 'page')
  })

  it('every section in the registry has a page', () => {
    expect(SECTIONS.every((section) => section.element)).toBe(true)
  })

  it('unknown dashboard paths offer a way home', async () => {
    renderAt('/admin/nope', signedIn)
    expect(await screen.findByRole('heading', { name: 'Nothing here' })).toBeInTheDocument()
  })

  it('returns to sign-in when the session expires mid-use', async () => {
    renderAt('/admin', signedIn)
    await screen.findByRole('heading', { name: 'Stats home' })
    window.dispatchEvent(new Event('jd-admin:signed-out'))
    await waitFor(() => expect(screen.getByText(/You were signed out/)).toBeInTheDocument())
  })

  it('opens and closes the phone menu', async () => {
    renderAt('/admin', signedIn)
    const open = await screen.findByRole('button', { name: 'Open menu' })
    fireEvent.click(open)
    expect(open).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(open).toHaveAttribute('aria-expanded', 'false')
  })
})
