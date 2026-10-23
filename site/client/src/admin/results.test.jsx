import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResultsSection from './sections/ResultsSection'
import { ToastProvider } from './components/Toasts'

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

const draft = {
  caption: 'Stage ready',
  alt: 'Client on stage',
  category: 'competition',
  kind: 'client',
  featured: true,
  image: { assetId: null, src: 'https://cdn/result.webp' },
  presentation: null,
  name: '',
  location: '',
  duration: '',
  summary: '',
  testimonial: null,
  stats: [],
  tags: [],
}

// Answers the editor's requests and records every draft it saves.
function server() {
  const saved = []
  const record = { id: '1', rev: 1, draft, published: draft, status: 'published', usage: [], updatedAt: new Date().toISOString() }
  const fetchMock = vi.fn((url, init = {}) => {
    if (init.method === 'PUT') {
      const body = JSON.parse(init.body)
      saved.push(body.draft)
      return json({ ...record, draft: body.draft, rev: body.rev + 1, status: 'changed' })
    }
    if (url.endsWith('/preview')) return json({ results: [] })
    return json(record)
  })
  return { fetchMock, saved }
}

function renderResult() {
  return render(
    <MemoryRouter initialEntries={['/admin/results/1']}>
      <ToastProvider><Routes><Route path="/admin/results/*" element={<ResultsSection />} /></Routes></ToastProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('result editor', () => {
  it('marks the fields a result needs before it can go live', async () => {
    vi.stubGlobal('fetch', server().fetchMock)
    renderResult()
    const photo = (await screen.findByRole('heading', { name: /^Photo/ })).closest('section')
    expect(within(photo).getAllByText('Required').length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/^Caption/)).toHaveAttribute('aria-required', 'true')
    expect(screen.getByLabelText(/^Headline/)).not.toHaveAttribute('aria-required')
  })

  it('adds a testimonial inside the result, with its own required fields', async () => {
    const { fetchMock, saved } = server()
    vi.stubGlobal('fetch', fetchMock)
    renderResult()
    fireEvent.click(await screen.findByRole('switch', { name: /Add a testimonial/ }))
    fireEvent.change(screen.getByLabelText(/^Quote/), { target: { value: 'Best prep I have done.' } })
    fireEvent.change(screen.getByLabelText(/^From/), { target: { value: 'Sam' } })
    expect(screen.getByLabelText(/^Quote/)).toHaveAttribute('aria-required', 'true')
    await waitFor(() => expect(saved.at(-1)?.testimonial).toEqual({ quote: 'Best prep I have done.', author: 'Sam', service: '', result: '' }), { timeout: 3000 })

    fireEvent.click(screen.getByRole('switch', { name: /Add a testimonial/ }))
    expect(screen.queryByLabelText(/^Quote/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: /Add a testimonial/ }))
    expect(screen.getByLabelText(/^Quote/)).toHaveValue('Best prep I have done.')
  })

  it('says where the result shows, with About only for a featured client result', async () => {
    const { fetchMock } = server()
    vi.stubGlobal('fetch', fetchMock)
    renderResult()
    expect(await screen.findByText('Shows on the Results page, the Home page gallery and the About page.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: /Feature on the About page/ }))
    expect(screen.getByText('Shows on the Results page and the Home page gallery.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Representative image/ }))
    expect(screen.queryByRole('switch', { name: /Feature on the About page/ })).not.toBeInTheDocument()
    expect(screen.getByText('Only client results can be featured on the About page.')).toBeInTheDocument()
  })

  it('crops a photo that fills its frame, by keyboard as well as dragging', async () => {
    const { fetchMock, saved } = server()
    vi.stubGlobal('fetch', fetchMock)
    renderResult()
    fireEvent.click(await screen.findByRole('switch', { name: /Fill the frame/ }))
    const crop = screen.getByRole('group', { name: 'Result photo: crop' })
    fireEvent.keyDown(crop, { key: 'ArrowRight' })
    fireEvent.keyDown(crop, { key: '+' })
    await waitFor(() => expect(saved.at(-1)?.presentation).toEqual({ fit: 'cover', focus: { x: 52, y: 50 }, zoom: 1.1 }), { timeout: 3000 })
  })
})
