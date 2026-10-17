import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Reorder, useDragControls } from 'motion/react'
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

function Row({ row, columns, selected, onSelect, reordering, onMove, onGrab, index, total }) {
  return (
    <>
      {reordering ? (
        // Dragging starts only from the grip, so the rest of the row still scrolls
        // the page on a phone. The arrow buttons are the keyboard alternative.
        <span className="jd-row-grip" aria-hidden="true" onPointerDown={onGrab}><JourneyIcon name="grip" size={18} /></span>
      ) : (
        <label className="jd-row-check-hit">
          <input
            type="checkbox"
            className="jd-row-check"
            checked={selected}
            onChange={(event) => onSelect(row.id, event.target.checked)}
            aria-label={`Select ${row.title}`}
          />
        </label>
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
          <button type="button" className="jd-admin-icon-button" data-move-row={row.id} data-dir="-1" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={`Move ${row.title} up`}>
            <JourneyIcon name="chevronDown" size={18} className="jd-flip" />
          </button>
          <button type="button" className="jd-admin-icon-button" data-move-row={row.id} data-dir="1" disabled={index === total - 1} onClick={() => onMove(index, 1)} aria-label={`Move ${row.title} down`}>
            <JourneyIcon name="chevronDown" size={18} />
          </button>
        </span>
      ) : (
        <span className="jd-row-updated">{timeAgo(row.updatedAt)}</span>
      )}
    </>
  )
}

function ReorderRow({ row, ...rest }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={row} className="jd-row" dragListener={false} dragControls={controls}>
      <Row row={row} reordering onGrab={(event) => controls.start(event)} {...rest} />
    </Reorder.Item>
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
  const [confirmBulk, setConfirmBulk] = useState(null)
  const orderTimer = useRef(null)
  const pendingOrder = useRef(null)

  const load = useCallback(() => listItems(collection)
    .then((items) => {
      setRows(items)
      setError('')
    })
    .catch((failure) => setError(failure.message)), [collection])

  const sendOrder = useCallback(() => {
    clearTimeout(orderTimer.current)
    const ids = pendingOrder.current
    pendingOrder.current = null
    if (!ids) return undefined
    return reorderItems(collection, ids)
  }, [collection])

  // Leaving the page inside the save delay still sends the new order.
  useEffect(() => {
    load()
    return () => {
      sendOrder()?.catch(() => {})
    }
  }, [load, sendOrder])

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
  // Bulk actions only touch rows the filters show, never ones selected earlier
  // and filtered out of sight since.
  const chosen = visible.filter((row) => selected.has(row.id))
  const allVisibleSelected = visible.length > 0 && chosen.length === visible.length
  const toggleAll = (checked) => setSelected(checked ? new Set(visible.map((row) => row.id)) : new Set())

  const runBulk = async (action) => {
    setBusy(true)
    try {
      const outcome = await bulkAction(collection, action, chosen.map((row) => row.id))
      setBanner(bulkMessage(action, outcome, rows))
      setSelected(new Set())
      await load()
    } catch (failure) {
      setBanner({ tone: 'error', text: failure.message })
    } finally {
      setBusy(false)
      setConfirmBulk(null)
    }
  }

  const saveOrder = (next) => {
    clearTimeout(orderTimer.current)
    pendingOrder.current = next.map((row) => row.id)
    orderTimer.current = setTimeout(() => {
      sendOrder()
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
    // At the top or bottom the pressed arrow becomes disabled and would drop
    // focus; move it to the row's other arrow instead.
    requestAnimationFrame(() => {
      const buttons = [...document.querySelectorAll(`[data-move-row="${CSS.escape(item.id)}"]`)]
      if (buttons.includes(document.activeElement) && !document.activeElement.disabled) return
      buttons.find((button) => !button.disabled)?.focus()
    })
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

      {!reordering && chosen.length > 0 && (
        <div className="jd-bulk-bar" role="region" aria-label="Selected items">
          <p><strong>{chosen.length}</strong> selected</p>
          <div className="jd-bulk-actions">
            <button type="button" className="jd-admin-button jd-admin-button--sm" disabled={busy} onClick={() => runBulk('publish')}>Publish</button>
            {canHide && <button type="button" className="jd-admin-button jd-admin-button--sm" disabled={busy} onClick={() => setConfirmBulk('unpublish')}>Hide</button>}
            {canDelete && <button type="button" className="jd-admin-button jd-admin-button--sm jd-admin-button--danger" disabled={busy} onClick={() => setConfirmBulk('delete')}>Delete</button>}
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
            <ReorderRow key={row.id} row={row} columns={columns} onMove={move} index={index} total={rows.length} />
          ))}
        </Reorder.Group>
      )}

      {confirmBulk && (
        <ConfirmDialog
          title={`${confirmBulk === 'delete' ? 'Delete' : 'Hide'} ${chosen.length} ${chosen.length === 1 ? noun : `${noun}s`}?`}
          confirmLabel={confirmBulk === 'delete' ? 'Delete' : 'Hide from site'}
          tone={confirmBulk === 'delete' ? 'danger' : 'primary'}
          busy={busy}
          onConfirm={() => runBulk(confirmBulk)}
          onCancel={() => setConfirmBulk(null)}
        >
          <p>{confirmBulk === 'delete'
            ? 'They are removed from the site and from your dashboard. This cannot be undone.'
            : 'They come off the site straight away. They stay here, and you can publish them again at any time.'}</p>
        </ConfirmDialog>
      )}
    </div>
  )
}

