import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { PAGE_META } from '../content/siteDefaults'
import { useSettings } from './useSettings'

export const SITE_URL = 'https://team-jd.com.au'
export const SITE_NAME = 'Team JD'
const DEFAULT_TITLE = 'Team JD | Jake Dedert Fitness Coaching'

function setTag(selector, create, value) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  el.setAttribute(el.tagName === 'LINK' ? 'href' : 'content', value)
}

const meta = (attr, key) => () => {
  const el = document.createElement('meta')
  el.setAttribute(attr, key)
  return el
}

// Per-route title, description, canonical and share tags. index.html carries the
// site-wide defaults for crawlers that do not run JavaScript; this refines them
// for the ones that do (Google) and for the browser tab.
//
// `page` names a page in PAGE_META: its built-in words, overridden by anything
// Jake has set in the dashboard's Settings > Search listings.
export function usePageMeta({ page, title: givenTitle, description: givenDescription, noindex = false } = {}) {
  const { pathname } = useLocation()
  const { seo } = useSettings()
  const builtIn = page ? PAGE_META[page] : null
  const title = (page && seo[page]?.title) || builtIn?.title || givenTitle
  const description = (page && seo[page]?.description) || builtIn?.description || givenDescription

  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE
    const url = `${SITE_URL}${pathname === '/' ? '/' : pathname.replace(/\/+$/, '')}`

    document.title = fullTitle
    setTag('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), url)
    setTag('meta[property="og:title"]', meta('property', 'og:title'), fullTitle)
    setTag('meta[property="og:url"]', meta('property', 'og:url'), url)
    if (description) {
      setTag('meta[name="description"]', meta('name', 'description'), description)
      setTag('meta[property="og:description"]', meta('property', 'og:description'), description)
    }
    setTag('meta[name="robots"]', meta('name', 'robots'), noindex ? 'noindex' : 'index, follow')
  }, [title, description, noindex, pathname])
}
