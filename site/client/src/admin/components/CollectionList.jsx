import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Reorder } from 'motion/react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import JourneyIcon from '../../components/JourneyIcon'
import { bulkAction, createItem, listItems, reorderItems } from '../api'
import { ConfirmDialog, StatusChip, timeAgo } from './ui'

const STATUS_FILTERS = [
  { value: '', label: 'Any status' },
  { value: 'published', label: 'Live' },
  { value: 'changed', label: 'Changes not live' },
  { value: 'draft', label: 'Draft' },
  { value: 'hidden', label: 'Hidden' },
]

const BULK_LABELS = { publish: 'Published', unpublish: 'Hidden', delete: 'Deleted' }

function bulkMessage(action, outcome, rows) {
  const title = (id) => rows.find((row) => row.id === id)?.title || 'An item'
  const parts = []
  if (outcome.done.length) parts.push(`${BULK_LABELS[action]} ${outcome.done.length}.`)
  if (outcome.failed.length) {
    parts.push(`${outcome.failed.length} could not change: ${outcome.failed.map((item) => `${title(item.id)} (${item.error})`).join('; ')}`)
  }
  return { tone: outcome.failed.length ? 'error' : 'notice', text: parts.join(' ') }
}

function Row({ row, columns, selected, onSelect, reordering, onMove, index, total }) {
  return (
    <>
      {reordering ? (
        <span className="jd-row-grip" aria-hidden="true"><JourneyIcon name="grip" size={18} /></span>
      ) : (
        <input
          type="checkbox"
          className="jd-row-check"
          checked={selected}
          onChange={(event) => onSelect(row.id, event.target.checked)}
          aria-label={`Select ${row.title}`}
        />
      )}
      {'thumbnail' in row && (
        <span className="jd-row-thumb">
          {row.thumbnail ? <img src={row.thumbnail} alt="" loading="lazy" width="48" height="48" /> : <JourneyIcon name="image" size={18} />}
        </span>
      )}
      <span className="jd-row-main">
        {reordering ? (
          <span className="jd-row-title">{row.title}</span>
        ) : (
          <Link className="jd-row-title jd-row-link" to={row.id}>{row.title}</Link>
        )}
        {row.subtitle && <span className="jd-row-subtitle">{row.subtitle}</span>}
      </span>
      {columns.map((column) => (
        <span key={column.key} className="jd-row-cell" data-label={column.label}>{column.render(row)}</span>
      ))}
      <span className="jd-row-status"><StatusChip status={row.status} /></span>
      {reordering ? (
        <span className="jd-row-move">
          <button type="button" className="jd-admin-icon-button" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={`Move ${row.title} up`}>
            <JourneyIcon name="chevronDown" size={18} className="jd-flip" />
          </button>
          <button type="button" className="jd-admin-icon-button" disabled={index === total - 1} onClick={() => onMove(index, 1)} aria-label={`Move ${row.title} down`}>
            <JourneyIcon name="chevronDown" size={18} />
          </button>
        </span>
      ) : (
        <span className="jd-row-updated">{timeAgo(row.updatedAt)}</span>
      )}
    </>
  )
}

// A collection's list page: search, filters, bulk actions, reordering, and a
// button to add a new item. Filters live in the URL so a refresh keeps them.
export default function CollectionList({
  collection,
  title,
  description,
  noun,
  newDraft,
  columns = [],
  filters = [],
  emptyText,
  reorderHint,
  canHide = true,
  canDelete = true,
}) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [reordering, setReordering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const orderTimer = useRef(null)

  const load = useCallback(() => listItems(collection)
    .then((items) => {
      setRows(items)
      setError('')
    })
    .catch((failure) => setError(failure.message)), [collection])

  useEffect(() => {
    load()
    return () => clearTimeout(orderTimer.current)
  }, [load])

  const query = params.get('q') || ''
  const statusFilter = params.get('status') || ''
  const setParam = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const visible = useMemo(() => {
    if (!rows) return []
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => (
      (!statusFilter || row.status === statusFilter)
      && filters.every((filter) => !params.get(filter.key) || filter.match(row, params.get(filter.key)))
      && (!needle || `${row.title} ${row.subtitle || ''}`.toLowerCase().includes(needle))
    ))
  }, [rows, query, statusFilter, filters, params])

  const selectRow = (id, checked) => setSelected((current) => {
    const next = new Set(current)
    if (checked) next.add(id)
    else next.delete(id)
    return next
  })
  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row.id))
  const toggleAll = (checked) => setSelected(checked ? new Set(visible.map((row) => row.id)) : new Set())

  const runBulk = async (action) => {
    setBusy(true)
    try {
      const outcome = await bulkAction(collection, action, [...selected])
      setBanner(bulkMessage(action, outcome, rows))
      setSelected(new Set())
      await load()
    } catch (failure) {
      setBanner({ tone: 'error', text: failure.message })
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  const saveOrder = (next) => {
    clearTimeout(orderTimer.current)
    orderTimer.current = setTimeout(() => {
      reorderItems(collection, next.map((row) => row.id))
        .then(() => setBanner({ tone: 'notice', text: 'New order saved. It is live on the site.' }))
        .catch((failure) => {
          setBanner({ tone: 'error', text: failure.message })
          load()
        })
    }, 600)
  }
  const reorder = (next) => {
    setRows(next)
    saveOrder(next)
  }
  const move = (index, delta) => {
    const next = [...rows]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    reorder(next)
  }

  const createNew = async () => {
    setBusy(true)
    try {
      const created = await createItem(collection, newDraft)
      navigate(created.id)
    } catch (failure) {
      setBanner({ tone: 'error', text: failure.message })
      setBusy(false)
    }
  }

  const filtersActive = Boolean(query || statusFilter || filters.some((filter) => params.get(filter.key)))

  return (
    <div className="jd-list-page">
      <div className="jd-list-head">
        <div>
          <h1 className="jd-page-title">{title}</h1>
          {description && <p className="jd-page-lede">{description}</p>}
        </div>
        <div className="jd-list-head-actions">
          {rows && rows.length > 1 && (
            <button type="button" className="jd-admin-button" aria-pressed={reordering} onClick={() => { setReordering(!reordering); setSelected(new Set()) }}>
              {reordering ? 'Done reordering' : 'Reorder'}
            </button>
          )}
          {newDraft && (
            <button type="button" className="jd-admin-button jd-admin-button--primary" onClick={createNew} disabled={busy}>
              <JourneyIcon name="plus" size={16} />
              New {noun}
            </button>
          )}
        </div>
      </div>

      {banner && (
        <div className={banner.tone === 'error' ? 'jd-admin-error' : 'jd-admin-notice'} role={banner.tone === 'error' ? 'alert' : 'status'}>
          {banner.text}
        </div>
      )}
      {error && <p className="jd-admin-error" role="alert">{error}</p>}

      {reordering ? (
        <p className="jd-list-hint">{reorderHint || 'Drag to reorder, or use the arrows.'} The new order goes live straight away.</p>
      ) : (
        <div className="jd-list-tools">
          <label className="jd-search">
            <JourneyIcon name="search" size={16} />
            <span className="visually-hidden">Search {title.toLowerCase()}</span>
            <input className="jd-input" type="search" value={query} placeholder="Search" spellCheck={false}
              onChange={(event) => setParam('q', event.target.value)} />
          </label>
          <label>
            <span className="visually-hidden">Status</span>
            <select className="jd-input jd-select" value={statusFilter} onChange={(event) => setParam('status', event.target.value)}>
              {STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {filters.map((filter) => (
            <label key={filter.key}>
              <span className="visually-hidden">{filter.label}</span>
              <select className="jd-input jd-select" value={params.get(filter.key) || ''} onChange={(event) => setParam(filter.key, event.target.value)}>
                <option value="">{filter.anyLabel}</option>
                {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}

      {!reordering && selected.size > 0 && (
        <div className="jd-bulk-bar" role="region" aria-label="Selected items">
          <p><strong>{selected.size}</strong> selected</p>
          <div className="jd-bulk-actions">
            <button type="button" className="jd-admin-button jd-admin-button--sm" disabled={busy} onClick={() => runBulk('publish')}>Publish</button>
            {canHide && <button type="button" className="jd-admin-button jd-admin-button--sm" disabled={busy} onClick={() => runBulk('unpublish')}>Hide</button>}
            {canDelete && <button type="button" className="jd-admin-button jd-admin-button--sm jd-admin-button--danger" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete</button>}
            <button type="button" className="jd-link-button" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        </div>
      )}

      {!rows && !error && <div className="jd-skeleton jd-skeleton--list" role="status" aria-label="Loading" />}

      {rows && rows.length === 0 && (
        <div className="jd-empty jd-empty--inline">
          <p>{emptyText}</p>
        </div>
      )}

      {rows && rows.length > 0 && !reordering && (
        <>
          <div className="jd-list-meta">
            <label className="jd-select-all">
              <input type="checkbox" checked={allVisibleSelected} onChange={(event) => toggleAll(event.target.checked)} />
              Select all {visible.length}
            </label>
            <span>{visible.length === rows.length ? `${rows.length} ${rows.length === 1 ? noun : `${noun}s`}` : `${visible.length} of ${rows.length}`}</span>
          </div>
          {visible.length === 0 ? (
            <div className="jd-empty jd-empty--inline">
              <p>Nothing matches these filters.</p>
              {filtersActive && <button type="button" className="jd-link-button" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}
            </div>
          ) : (
            <ul className="jd-rows">
              {visible.map((row) => (
                <li key={row.id} className={`jd-row${selected.has(row.id) ? ' is-selected' : ''}`}>
                  <Row row={row} columns={columns} selected={selected.has(row.id)} onSelect={selectRow} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {rows && reordering && (
        <Reorder.Group axis="y" values={rows} onReorder={reorder} className="jd-rows jd-rows--reorder">
          {rows.map((row, index) => (
            <Reorder.Item key={row.id} value={row} className="jd-row">
              <Row row={row} columns={columns} reordering onMove={move} index={index} total={rows.length} />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${selected.size} ${selected.size === 1 ? noun : `${noun}s`}?`}
          confirmLabel="Delete"
          tone="danger"
          busy={busy}
          onConfirm={() => runBulk('delete')}
          onCancel={() => setConfirmDelete(false)}
        >
          <p>They are removed from the site and from your dashboard. This cannot be undone.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}

