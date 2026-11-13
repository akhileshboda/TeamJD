// The six seeded client results plus 114 extra entries, so paging, filtering and
// search run against a full library. Every result is a client result (the stock
// "representative" type was removed in November 2026).
import seed from '../../../../server/seed/results-library.json'
import extra from './extraResults.json'

export default [...seed, ...extra.map((item) => ({ ...item, kind: 'client' }))]
