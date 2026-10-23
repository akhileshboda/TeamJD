import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CollectionList from './components/CollectionList'
import RecordEditor from './components/RecordEditor'
import { TextField } from './components/fields'
import { ToastProvider } from './components/Toasts'

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
      <ToastProvider><Routes>
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
      </Routes></ToastProvider>
    </MemoryRouter>,
  )
}

describe('collection list', () => {
  it('filters by Live, Offline and Unpublished changes, custom filters and search, from the URL', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ items: rows })))
    renderList('/admin/things?category=posing')
    expect(await screen.findByRole('link', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bravo' })).not.toBeInTheDocument()

    const status = screen.getByLabelText('Status')
    expect([...status.options].map((option) => option.text)).toEqual(['Any status', 'Live', 'Offline', 'Unpublished changes'])
    fireEvent.change(status, { target: { value: 'changes' } })
    expect(screen.queryByRole('link', { name: 'Alpha' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Charlie' })).toBeInTheDocument()
    fireEvent.change(status, { target: { value: 'live' } })
    expect(screen.getByRole('link', { name: 'Alpha' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search things'), { target: { value: 'zzz' } })
    expect(screen.getByText('Nothing matches these filters.')).toBeInTheDocument()
  })

  it('offers only the bulk actions that apply, each named the same as everywhere else', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ items: rows })))
    renderList()
    const bar = () => within(screen.getByRole('region', { name: 'Selected items' }))
    const labels = () => bar().getAllByRole('button').map((button) => button.textContent)
    fireEvent.click(await screen.findByLabelText('Select Bravo'))
    expect(labels()).toEqual(['Go live', 'Delete', 'Clear'])
    fireEvent.click(screen.getByLabelText('Select Charlie'))
    expect(labels()).toEqual(['Go live (1)', 'Publish changes (1)', 'Take offline (1)', 'Delete', 'Clear'])
    fireEvent.click(screen.getByLabelText('Select Bravo'))
    expect(labels()).toEqual(['Publish changes', 'Take offline', 'Delete', 'Clear'])
  })

  it('sends each bulk action only the rows it applies to, and reports what could not change', async () => {
    const bulk = []
    vi.stubGlobal('fetch', vi.fn((url, init = {}) => {
      if (url.endsWith('/bulk')) {
        bulk.push(JSON.parse(init.body))
        return json({ done: [], failed: [{ collection: 'things', id: 'b', error: 'Some fields need attention.', fields: { caption: 'Add a caption.' } }] })
      }
      return json({ items: rows })
    }))
    renderList()
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Select all' }))
    fireEvent.click(within(screen.getByRole('region', { name: 'Selected items' })).getByRole('button', { name: 'Go live (1)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('1 could not change: Bravo (Add a caption.)')
    expect(bulk).toEqual([{ action: 'publish', ids: ['b'] }])
  })

  it('asks before taking items offline or deleting them', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ items: rows })))
    renderList()
    fireEvent.click(await screen.findByLabelText('Select Alpha'))
    fireEvent.click(screen.getByLabelText('Select Charlie'))
    fireEvent.click(screen.getByRole('button', { name: 'Take offline' }))
    expect(screen.getByRole('alertdialog', { name: 'Take 2 things offline?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('alertdialog', { name: 'Delete 2 things?' })).toBeInTheDocument()
  })

  it('labels every column, and selects all from the header', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ items: rows })))
    renderList()
    const table = await screen.findByRole('table', { name: 'Things' })
    const headers = within(table).getAllByRole('columnheader').map((cell) => cell.textContent)
    expect(headers).toEqual(['', 'Thing', 'Live', 'Changes', 'Updated'])
    fireEvent.click(within(table).getByRole('checkbox', { name: 'Select all' }))
    expect(within(screen.getByRole('region', { name: 'Selected items' })).getByText('3')).toBeInTheDocument()
    const charlie = within(table).getByRole('link', { name: 'Charlie' }).closest('[role="row"]')
    expect(within(charlie).getByText('Unpublished changes')).toBeInTheDocument()
  })

  it('switches a row live and offline, and says what is missing when it cannot go live', async () => {
    const bulk = []
    vi.stubGlobal('fetch', vi.fn((url, init = {}) => {
      if (url.endsWith('/bulk')) {
        const body = JSON.parse(init.body)
        bulk.push(body)
        if (body.action === 'publish') {
          return json({ done: [], failed: [{ collection: 'things', id: 'b', error: 'Some fields need attention.', fields: { caption: 'Add a caption.' } }] })
        }
        return json({ done: [{ collection: 'things', id: 'a' }], failed: [] })
      }
      return json({ items: rows })
    }))
    renderList()
    const alpha = await screen.findByRole('switch', { name: 'Live: Alpha' })
    expect(alpha).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(alpha)
    expect(await screen.findByRole('status')).toHaveTextContent('“Alpha” is offline.')

    const bravo = screen.getByRole('switch', { name: 'Live: Bravo' })
    expect(bravo).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(bravo)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('“Bravo” cannot go live yet. Add a caption.')
    expect(within(alert).getByRole('link', { name: 'Open it' })).toHaveAttribute('href', '/admin/things/b')
    // The success toast from the same list was replaced, not stacked.
    expect(screen.queryByText(/“Alpha” is offline/)).not.toBeInTheDocument()
    expect(bulk).toEqual([{ action: 'unpublish', ids: ['a'] }, { action: 'publish', ids: ['b'] }])
  })

  it('has no Live switch where items cannot be taken offline', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ items: rows })))
    render(
      <MemoryRouter initialEntries={['/admin/things']}>
        <ToastProvider><Routes>
          <Route path="/admin/things/*" element={<CollectionList collection="things" title="Things" noun="thing" canHide={false} emptyText="" />} />
        </Routes></ToastProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByRole('link', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Live' })).not.toBeInTheDocument()
    expect([...screen.getByLabelText('Status').options].map((option) => option.text)).toEqual(['Any status', 'Unpublished changes'])
  })
})

const liveRecord = { id: 'a', status: 'published', draft: { caption: 'Live caption' }, published: { caption: 'Live caption' } }
const draftRecord = { id: 'a', status: 'draft', draft: { caption: '' }, published: null }

function editorServer({ publishFails = false, start = liveRecord } = {}) {
  const calls = []
  let rev = 3
  const record = { ...start, rev, usage: [], updatedAt: new Date().toISOString() }
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
      return json({ ...record, rev, status: 'published', published: record.draft })
    }
    if (url.endsWith('/unpublish')) {
      rev += 1
      return json({ ...record, rev, status: 'hidden', published: null })
    }
    return json(record)
  })
  return { fetchMock, calls }
}

function renderEditor({ state } = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin/things/a', state }]}>
      <ToastProvider><Routes>
        <Route path="/admin/things/:id" element={(
          <RecordEditor
            collection="things"
            id="a"
            backTo="/admin/things"
            backLabel="Things"
            noun="thing"
            titleOf={(draft) => draft.caption}
            previewPath={() => null}
            siteLocation={() => ['the Things page', 'the Home page']}
            renderFields={({ draft, update, errors }) => (
              <TextField label="Caption" value={draft.caption} error={errors.caption} onChange={(caption) => update({ caption })} />
            )}
          />
        )} />
      </Routes></ToastProvider>
    </MemoryRouter>,
  )
}

describe('record editor', () => {
  it('autosaves edits as a draft with the current revision, then publishes', async () => {
    const { fetchMock, calls } = editorServer()
    vi.stubGlobal('fetch', fetchMock)
    renderEditor()
    const field = await screen.findByLabelText('Caption')
    expect(screen.getByText('Live.')).toBeInTheDocument()
    expect(screen.getByText('Shows on the Things page and the Home page.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish changes' })).not.toBeInTheDocument()

    fireEvent.change(field, { target: { value: 'New caption' } })
    expect(screen.getByText('Live, with unpublished changes.')).toBeInTheDocument()
    expect(screen.getByText('Unpublished changes')).toBeInTheDocument()
    await waitFor(() => expect(calls.some(([method]) => method === 'PUT')).toBe(true), { timeout: 3000 })
    const put = calls.find(([method]) => method === 'PUT')
    expect(put[2]).toEqual({ draft: { caption: 'New caption' }, rev: 3 })
    await screen.findByText(/^Saved/)

    fireEvent.click(screen.getByRole('button', { name: 'Publish changes' }))
    expect(await screen.findByText('Changes published. They are live now.')).toBeInTheDocument()
  })

  it('takes the item offline and back live with the Live switch', async () => {
    const { fetchMock, calls } = editorServer()
    vi.stubGlobal('fetch', fetchMock)
    renderEditor()
    const live = await screen.findByRole('switch', { name: 'Live' })
    expect(live).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(live)
    expect(await screen.findByText(/^Offline now\. Your edits are kept/)).toBeInTheDocument()
    expect(live).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Switch on Live to show it on the Things page and the Home page.')).toBeInTheDocument()

    fireEvent.click(live)
    expect(await screen.findByText('Live now.')).toBeInTheDocument()
    expect(calls.filter(([method]) => method === 'POST').map(([, url]) => url.split('/').pop())).toEqual(['unpublish', 'publish'])
  })

  it('keeps an offline item offline and points at the fields to fill when going live is refused', async () => {
    const { fetchMock } = editorServer({ start: draftRecord, publishFails: true })
    vi.stubGlobal('fetch', fetchMock)
    renderEditor()
    const live = await screen.findByRole('switch', { name: 'Live' })
    expect(screen.getByText('Offline.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish changes' })).not.toBeInTheDocument()
    fireEvent.click(live)
    expect(await screen.findByRole('alert')).toHaveTextContent('Some fields need attention')
    expect(live).toHaveAttribute('aria-checked', 'false')
    await waitFor(() => expect(screen.getByLabelText('Caption')).toHaveFocus())
  })

  it('shows the fields the list found missing when opened from it', async () => {
    vi.stubGlobal('fetch', editorServer({ start: draftRecord }).fetchMock)
    renderEditor({ state: { fieldErrors: { caption: 'Add a short caption.' } } })
    expect(await screen.findByText('Add a short caption.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Caption')).toHaveFocus())
  })

  it('shows the fields to fix when publishing fails validation', async () => {
    const { fetchMock } = editorServer({ publishFails: true })
    vi.stubGlobal('fetch', fetchMock)
    renderEditor()
    fireEvent.change(await screen.findByLabelText('Caption'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publish changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Some fields need attention')
    expect(screen.getByText('Add a short caption.')).toBeInTheDocument()
  })
})
