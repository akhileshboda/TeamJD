import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Reorder, useDragControls } from 'motion/react'
import { Link, useNavigate, useResolvedPath, useSearchParams } from 'react-router-dom'
import JourneyIcon from '../../components/JourneyIcon'
import { bulkAction, createItem, listItems, reorderItems } from '../api'
import { Chip, ConfirmDialog, hasUnpublishedChanges, isLive, LiveSwitch, STATUS_HELP, timeAgo } from './ui'
import { useToast } from './Toasts'

const STATUS_FILTERS = [
  { value: 'live', label: 'Live', match: isLive, needsSwitch: true },
  { value: 'offline', label: 'Offline', match: (status) => !isLive(status), needsSwitch: true },
  { value: 'changes', label: 'Unpublished changes', match: hasUnpublishedChanges },
]

const counted = (count, noun) => `${count} ${count === 1 ? noun : `${noun}s`}`

// Each bulk action applies only to the chosen rows it makes sense for (Go
// live to offline ones, and so on), and is offered only when there are some.
const BULK_ACTIONS = [
  { key: 'goLive', label: 'Go live', server: 'publish', needsSwitch: true, applies: (row) => !isLive(row.status),
    done: (count, noun) => `${counted(count, noun)} ${count === 1 ? 'is' : 'are'} live now.` },
  { key: 'publishChanges', label: 'Publish changes', server: 'publish', applies: (row) => hasUnpublishedChanges(row.status),
    done: (count, noun) => `Published the changes to ${counted(count, noun)}.` },
  { key: 'takeOffline', label: 'Take offline', server: 'unpublish', needsSwitch: true, confirm: true, applies: (row) => isLive(row.status),
    done: (count, noun) => `${counted(count, noun)} ${count === 1 ? 'is' : 'are'} offline now.` },
  { key: 'delete', label: 'Delete', server: 'delete', needsDelete: true, confirm: true, applies: () => true,
    done: (count, noun) => `Deleted ${counted(count, noun)}.` },
]

const failureReason = (failure) => (failure.fields ? Object.values(failure.fields).join(' ') : failure.error)

function bulkMessage(action, outcome, rows, noun) {
  const title = (id) => rows.find((row) => row.id === id)?.title || 'An item'
  const parts = []
  if (outcome.done.length) parts.push(action.done(outcome.done.length, noun))
  if (outcome.failed.length) {
    parts.push(`${outcome.failed.length} could not change: ${outcome.failed.map((item) => `${title(item.id)} (${failureReason(item)})`).join('; ')}`)
  }
  return { tone: outcome.failed.length ? 'error' : 'notice', text: parts.join(' ') }
}

// A refused Go live lists what is missing, and offers the editor with those
// fields already marked. Toasts show outside this page's routes, so the link
// is absolute.
function switchMessage(row, on, outcome, base) {
  const failure = outcome.failed[0]
  if (!failure) {
    return { tone: 'notice', text: on ? `“${row.title}” is live.` : `“${row.title}” is offline. Switch it back on any time.` }
  }
  return {
    tone: 'error',
    text: on ? `“${row.title}” cannot go live yet. ${failureReason(failure)}` : `“${row.title}” could not be taken offline. ${failure.error}`,
    action: { label: 'Open it', to: `${base}/${row.id}`, state: { fieldErrors: failure.fields } },
  }
}

const capitalise = (word) => word.charAt(0).toUpperCase() + word.slice(1)

// Column labels for the rows below. Each cell reuses its row cell's class, so
// widths and the columns hidden on small screens always match.
function HeaderRow({ noun, columns, showThumb, canHide, reordering, allSelected, onToggleAll }) {
  return (
    <div className="jd-row jd-row--head" role="row">
      {reordering ? (
        <span className="jd-row-grip" role="columnheader"><span className="visually-hidden">Drag</span></span>
      ) : (
        <span role="columnheader" className="jd-row-select">
          <label className="jd-row-check-hit">
            <input type="checkbox" className="jd-row-check" checked={allSelected} onChange={(event) => onToggleAll(event.target.checked)}
              aria-label="Select all" />
          </label>
        </span>
      )}
      {showThumb && <span className="jd-row-thumb" role="columnheader"><span className="visually-hidden">Photo</span></span>}
      <span className="jd-row-main" role="columnheader">{capitalise(noun)}</span>
      {columns.map((column) => <span key={column.key} className="jd-row-cell" role="columnheader">{column.label}</span>)}
      {canHide && <span className="jd-row-switch" role="columnheader">Live</span>}
      <span className="jd-row-status" role="columnheader">Changes</span>
      {reordering
        ? <span className="jd-row-move" role="columnheader">Move</span>
        : <span className="jd-row-updated" role="columnheader">Updated</span>}
    </div>
  )
}

function StatusHelp({ canHide }) {
  return (
    <details className="jd-status-help">
      <summary>What Live, Offline and Unpublished changes mean</summary>
      <dl>
        {STATUS_HELP.filter((entry) => canHide || entry.chip !== 'offline').map((entry) => (
          <div key={entry.chip}>
            <dt><Chip kind={entry.chip} /></dt>
            <dd>{entry.text}</dd>
          </div>
        ))}
      </dl>
      <p>Edits save automatically as you type. Nobody sees them until they are published.</p>
    </details>
  )
}

// `live` is the Live switch's state and handler, or null where items cannot be
// taken offline (services).
function Row({ row, columns, selected, onSelect, live, reordering, onMove, onGrab, index, total }) {
  return (
    <>
      {reordering ? (
        // Dragging starts only from the grip, so the rest of the row still scrolls
        // the page on a phone. The arrow buttons are the keyboard alternative.
        <span className="jd-row-grip" role="cell" onPointerDown={onGrab}><JourneyIcon name="grip" size={18} /></span>
      ) : (
        <span className="jd-row-select" role="cell">
          <label className="jd-row-check-hit">
            <input
              type="checkbox"
              className="jd-row-check"
              checked={selected}
              onChange={(event) => onSelect(row.id, event.target.checked)}
              aria-label={`Select ${row.title}`}
            />
          </label>
        </span>
      )}
      {'thumbnail' in row && (
        <span className="jd-row-thumb" role="cell">
          {row.thumbnail ? <img src={row.thumbnail} alt="" loading="lazy" width="48" height="48" /> : <JourneyIcon name="image" size={18} />}
        </span>
      )}
      <span className="jd-row-main" role="cell">
        {reordering ? (
          <span className="jd-row-title">{row.title}</span>
        ) : (
          <Link className="jd-row-title jd-row-link" to={row.id}>{row.title}</Link>
        )}
        {row.subtitle && <span className="jd-row-subtitle">{row.subtitle}</span>}
      </span>
      {columns.map((column) => (
        <span key={column.key} className="jd-row-cell" role="cell">{column.render(row)}</span>
      ))}
      {live && (
        <span className="jd-row-switch" role="cell">
          <LiveSwitch on={isLive(row.status)} busy={live.busy} label={`Live: ${row.title}`} hideLabel onChange={live.onChange} />
        </span>
      )}
      <span className="jd-row-status" role="cell">
        {hasUnpublishedChanges(row.status)
          ? <Chip kind="changes" />
          : <span className="jd-row-none"><span aria-hidden="true">—</span><span className="visually-hidden">None</span></span>}
      </span>
      {reordering ? (
        <span className="jd-row-move" role="cell">
          <button type="button" className="jd-admin-icon-button" data-move-row={row.id} data-dir="-1" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={`Move ${row.title} up`}>
            <JourneyIcon name="chevronDown" size={18} className="jd-flip" />
          </button>
          <button type="button" className="jd-admin-icon-button" data-move-row={row.id} data-dir="1" disabled={index === total - 1} onClick={() => onMove(index, 1)} aria-label={`Move ${row.title} down`}>
            <JourneyIcon name="chevronDown" size={18} />
          </button>
        </span>
      ) : (
        <span className="jd-row-updated" role="cell">{timeAgo(row.updatedAt)}</span>
      )}
    </>
  )
}

function ReorderRow({ row, ...rest }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={row} className="jd-row" role="row" dragListener={false} dragControls={controls}>
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
  const toast = useToast()
  const base = useResolvedPath('.').pathname.replace(/\/$/, '')
  const notify = useCallback((message) => toast({ ...message, scope: `list:${collection}` }), [toast, collection])
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [reordering, setReordering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState(null)
  const [switching, setSwitching] = useState(null)
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
  const statusFilters = STATUS_FILTERS.filter((option) => canHide || !option.needsSwitch)
  const statusFilter = statusFilters.find((option) => option.value === params.get('status'))
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
      (!statusFilter || statusFilter.match(row.status))
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

  const bulkActions = BULK_ACTIONS
    .filter((action) => (canHide || !action.needsSwitch) && (canDelete || !action.needsDelete))
    .map((action) => ({ ...action, rows: chosen.filter(action.applies) }))
    .filter((action) => action.rows.length > 0)

  const runBulk = async (action) => {
    setBusy(true)
    try {
      const outcome = await bulkAction(collection, action.server, action.rows.map((row) => row.id))
      notify(bulkMessage(action, outcome, rows, noun))
      setSelected(new Set())
      await load()
    } catch (failure) {
      notify({ tone: 'error', text: failure.message })
    } finally {
      setBusy(false)
      setConfirmBulk(null)
    }
  }

  // One row's Live switch. It uses the bulk endpoint, which needs no revision
  // and reports missing fields per item.
  const switchRow = async (row, on) => {
    setSwitching(row.id)
    try {
      const outcome = await bulkAction(collection, on ? 'publish' : 'unpublish', [row.id])
      notify(switchMessage(row, on, outcome, base))
      await load()
    } catch (failure) {
      notify({ tone: 'error', text: failure.message })
    } finally {
      setSwitching(null)
    }
  }
  const liveSwitch = (row) => (canHide ? { busy: switching === row.id, onChange: (on) => switchRow(row, on) } : null)

  const saveOrder = (next) => {
    clearTimeout(orderTimer.current)
    pendingOrder.current = next.map((row) => row.id)
    orderTimer.current = setTimeout(() => {
      sendOrder()
        .then(() => notify({ tone: 'notice', text: 'New order saved. It is live now.' }))
        .catch((failure) => {
          notify({ tone: 'error', text: failure.message })
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
      notify({ tone: 'error', text: failure.message })
      setBusy(false)
    }
  }

  const header = { noun, columns, canHide, showThumb: Boolean(rows?.some((row) => 'thumbnail' in row)) }
  const filtersActive = Boolean(query || params.get('status') || filters.some((filter) => params.get(filter.key)))

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
            <select className="jd-input jd-select" value={statusFilter?.value || ''} onChange={(event) => setParam('status', event.target.value)}>
              <option value="">Any status</option>
              {statusFilters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
      {rows && rows.length > 0 && <StatusHelp canHide={canHide} />}

      {!reordering && chosen.length > 0 && (
        <div className="jd-bulk-bar" role="region" aria-label="Selected items">
          <p><strong>{chosen.length}</strong> selected</p>
          <div className="jd-bulk-actions">
            {bulkActions.map((action) => (
              <button key={action.key} type="button" disabled={busy}
                className={`jd-admin-button jd-admin-button--sm${action.key === 'delete' ? ' jd-admin-button--danger' : ''}`}
                onClick={() => (action.confirm ? setConfirmBulk(action) : runBulk(action))}>
                {action.label}{action.rows.length < chosen.length ? ` (${action.rows.length})` : ''}
              </button>
            ))}
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
          <p className="jd-list-meta">
            {visible.length === rows.length ? `${rows.length} ${rows.length === 1 ? noun : `${noun}s`}` : `${visible.length} of ${rows.length}`}
          </p>
          {visible.length === 0 ? (
            <div className="jd-empty jd-empty--inline">
              <p>Nothing matches these filters.</p>
              {filtersActive && <button type="button" className="jd-link-button" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}
            </div>
          ) : (
            <div className="jd-table" role="table" aria-label={title}>
              <HeaderRow {...header} allSelected={allVisibleSelected} onToggleAll={toggleAll} />
              <ul className="jd-rows" role="rowgroup">
                {visible.map((row) => (
                  <li key={row.id} role="row" className={`jd-row${selected.has(row.id) ? ' is-selected' : ''}`}>
                    <Row row={row} columns={columns} selected={selected.has(row.id)} onSelect={selectRow} live={liveSwitch(row)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {rows && reordering && (
        <div className="jd-table" role="table" aria-label={`${title}, in site order`}>
          <HeaderRow {...header} reordering />
          <Reorder.Group axis="y" values={rows} onReorder={reorder} className="jd-rows jd-rows--reorder" role="rowgroup">
            {rows.map((row, index) => (
              <ReorderRow key={row.id} row={row} columns={columns} live={liveSwitch(row)} onMove={move} index={index} total={rows.length} />
            ))}
          </Reorder.Group>
        </div>
      )}

      {confirmBulk && (
        <ConfirmDialog
          title={`${confirmBulk.key === 'delete' ? 'Delete' : 'Take'} ${counted(confirmBulk.rows.length, noun)}${confirmBulk.key === 'delete' ? '' : ' offline'}?`}
          confirmLabel={confirmBulk.label}
          tone={confirmBulk.key === 'delete' ? 'danger' : 'primary'}
          busy={busy}
          onConfirm={() => runBulk(confirmBulk)}
          onCancel={() => setConfirmBulk(null)}
        >
          <p>{confirmBulk.key === 'delete'
            ? 'They are removed from the site and from your dashboard. This cannot be undone.'
            : 'They come off the site straight away. They stay here, and you can switch them back on at any time.'}</p>
        </ConfirmDialog>
      )}
    </div>
  )
}

