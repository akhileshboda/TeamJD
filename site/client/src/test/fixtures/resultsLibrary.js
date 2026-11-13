// The six seeded client results plus 114 stock "representative" entries. The
// stock entries left the seed in November 2026; tests keep them so paging,
// filtering and representative labelling still run against a full library.
import seed from '../../../../server/seed/results-library.json'
import representative from './representativeResults.json'

export default [...seed, ...representative]
