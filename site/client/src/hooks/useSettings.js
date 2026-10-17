import { CONTACT_FALLBACK } from '../content/siteDefaults'
import { useContent } from './useContent'

// Public site settings from the dashboard: contact details and search listings.
export function useSettings() {
  const { data } = useContent('settings')
  return {
    contact: data?.contact || CONTACT_FALLBACK,
    seo: data?.seo || {},
  }
}
