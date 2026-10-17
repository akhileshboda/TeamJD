import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CollectionList from './components/CollectionList'
import RecordEditor from './components/RecordEditor'
import { TextField } from './components/fields'

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const rows = [
  { id: 'a', order: 1, status: 'published', title: 'Alpha', subtitle: 'First', updatedAt: new Date().toISOString(), category: 'posing' },
  { id: 'b', order: 2, status: 'hidden', title: 'Bravo', subtitle: 'Second', updatedAt: new Date().toISOString(), category: 'competition' },
  { id: 'c', order: 3, status: 'changed', title: 'Charlie', subtitle: 'Third', updatedAt: new Date().toISOString(), category: 'posing' },
]

function renderList(path = '/admin/things') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/things/*" element={(
          <CollectionList
            collection="things"
            title="Things"
            noun="thing"
            newDraft={{}}
            filters={[{ key: 'category', label: 'Category', anyLabel: 'Any category', options: [{ value: 'posing', label: 'Posing' }], match: (row, value) => row.category === value }]}
            emptyText="Nothing yet."
          />
        )} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('collection list', () => {
  it('filters by status, custom filters and search, from the URL', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ items: rows })))
    renderList('/admin/things?category=posing')
    expect(await screen.findByRole('link', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bravo' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'changed' } })
    expect(screen.queryByRole('link', { name: 'Alpha' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Charlie' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search things'), { target: { value: 'zzz' } })
    expect(screen.getByText('Nothing matches these filters.')).toBeInTheDocument()
  })

  it('runs bulk actions on the selection and reports what could not change', async () => {
    const fetchMock = vi.fn((url, init = {}) => {
      if (url.endsWith('/bulk')) {
        expect(JSON.parse(init.body)).toEqual({ action: 'publish', ids: ['a', 'b'] })
        return json({ done: [{ collection: 'things', id: 'a' }], failed: [{ collection: 'things', id: 'b', error: 'Add a caption.' }] })
      }
      return json({ items: rows })
    })
    vi.stubGlobal('fetch', fetchMock)
    renderList()
    fireEvent.click(await screen.findByLabelText('Select Alpha'))
    fireEvent.click(screen.getByLabelText('Select Bravo'))
    const bar = screen.getByRole('region', { name: 'Selected items' })
    expect(within(bar).getByText('2')).toBeInTheDocument()
    fireEvent.click(within(bar).getByRole('button', { name: 'Publish' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Published 1. 1 could not change: Bravo (Add a caption.)')
  })

  it('asks before deleting', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ items: rows })))
    renderList()
    fireEvent.click(await screen.findByLabelText('Select Charlie'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('alertdialog', { name: 'Delete 1 thing?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

function editorServer({ publishFails = false } = {}) {
  const calls = []
  let rev = 3
  const record = { id: 'a', rev, status: 'published', draft: { caption: 'Live caption' }, published: { caption: 'Live caption' }, usage: [], updatedAt: new Date().toISOString() }
  const fetchMock = vi.fn((url, init = {}) => {
    calls.push([init.method || 'GET', url, init.body && JSON.parse(init.body)])
    if (url.endsWith('/preview')) return json({ results: [] })
    if (init.method === 'PUT') {
      const body = JSON.parse(init.body)
      if (body.rev !== rev) return json({ error: 'Changed in another tab.' }, 409)
      rev += 1
      return json({ ...record, rev, draft: body.draft, status: 'changed' })
    }
    if (url.endsWith('/publish')) {
      if (publishFails) return json({ error: 'Some fields need attention before this can go live.', fields: { caption: 'Add a short caption.' } }, 422)
      rev += 1
      return json({ ...record, rev, status: 'published' })
    }
    return json(record)
  })
  return { fetchMock, calls }
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/admin/things/a']}>
      <Routes>
        <Route path="/admin/things/:id" element={(
          <RecordEditor
            collection="things"
            id="a"
            backTo="/admin/things"
            backLabel="Things"
            noun="thing"
            titleOf={(draft) => draft.caption}
            previewPath={() => null}
            renderFields={({ draft, update, errors }) => (
              <TextField label="Caption" value={draft.caption} error={errors.caption} onChange={(caption) => update({ caption })} />
            )}
          />
        )} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('record editor', () => {
  it('autosaves edits as a draft with the current revision, then publishes', async () => {
    const { fetchMock, calls } = editorServer()
    vi.stubGlobal('fetch', fetchMock)
    renderEditor()
    const field = await screen.findByLabelText('Caption')
    expect(screen.getByText('Everything here is live.')).toBeInTheDocument()

    fireEvent.change(field, { target: { value: 'New caption' } })
    expect(screen.getByText('Your changes are not live yet.')).toBeInTheDocument()
    await waitFor(() => expect(calls.some(([method]) => method === 'PUT')).toBe(true), { timeout: 3000 })
    const put = calls.find(([method]) => method === 'PUT')
    expect(put[2]).toEqual({ draft: { caption: 'New caption' }, rev: 3 })
    await screen.findByText(/^Saved/)

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('Published. It is live on the site now.')).toBeInTheDocument()
  })

  it('shows the fields to fix when publishing fails validation', async () => {
    const { fetchMock } = editorServer({ publishFails: true })
    vi.stubGlobal('fetch', fetchMock)
    renderEditor()
    fireEvent.change(await screen.findByLabelText('Caption'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Some fields need attention')
    expect(screen.getByText('Add a short caption.')).toBeInTheDocument()
  })
})
