// Opening an item from a list remembers where the list was (its filters and how
// far down it was scrolled), so the editor's Back link returns to the same spot.
// Kept per collection in sessionStorage; restoring reads it once and forgets it.

const key = (collection) => `jd-list-return:${collection}`

function read(collection) {
  try {
    return JSON.parse(sessionStorage.getItem(key(collection))) || null
  } catch {
    return null
  }
}

export function rememberListPosition(collection) {
  try {
    sessionStorage.setItem(key(collection), JSON.stringify({ search: window.location.search, scrollY: window.scrollY }))
  } catch {
    // Storage can be unavailable (private mode); Back then goes to the top of the list.
  }
}

// The list URL to go back to, with the filters it had.
export function listReturnPath(collection, backTo) {
  return `${backTo}${read(collection)?.search || ''}`
}

// How far down to scroll the list once its rows are on the page, or null.
export function takeListScroll(collection) {
  const saved = read(collection)
  try {
    sessionStorage.removeItem(key(collection))
  } catch {
    // Nothing to forget.
  }
  return Number.isFinite(saved?.scrollY) ? saved.scrollY : null
}
