// Changelog entries arrive from the server newest first: { date: 'YYYY-MM-DD', text }.

// Dates are calendar days, not moments, so format them in UTC to keep the day the
// same wherever the dashboard is opened.
const dateFormat = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export function formatChangelogDate(date) {
  return dateFormat.format(new Date(`${date}T00:00:00Z`))
}

// Every word typed has to appear in the update or its date, so "oct photos" works.
export function filterEntries(entries, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return entries
  return entries.filter((entry) => {
    const haystack = `${entry.text} ${formatChangelogDate(entry.date)}`.toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}

export function orderEntries(entries, order) {
  return order === 'oldest' ? [...entries].reverse() : entries
}
