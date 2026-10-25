import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PAGE_META } from '../content/siteDefaults'
import { usePageMeta } from './usePageMeta'

const settings = vi.hoisted(() => ({ seo: {} }))
vi.mock('./useSettings', () => ({ useSettings: () => ({ contact: {}, seo: settings.seo }) }))

function Page(props) {
  usePageMeta(props)
  return null
}

afterEach(() => {
  cleanup()
  document.head.querySelectorAll('meta[name], link[rel="canonical"]').forEach((el) => el.remove())
})

const head = (selector, attr = 'content') => document.head.querySelector(selector)?.getAttribute(attr)

describe('page meta', () => {
  it('uses the page\'s built-in words, then any override from Settings', () => {
    render(<MemoryRouter initialEntries={['/about']}><Page page="about" /></MemoryRouter>)
    expect(document.title).toBe('About Jake Dedert | Team JD')

    settings.seo = { about: { title: 'Meet Jake', description: 'Coach.' } }
    render(<MemoryRouter initialEntries={['/about']}><Page page="about" /></MemoryRouter>)
    expect(document.title).toBe('Meet Jake | Team JD')
    expect(document.head.querySelector('meta[name="description"]').getAttribute('content')).toBe('Coach.')
  })

  it('points canonicals at the address the server wrote into the page', () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="teamjd:site-url" content="https://jake-preview.team-jd.com.au/">')
    render(<MemoryRouter initialEntries={['/services/']}><Page page="services" /></MemoryRouter>)
    expect(head('link[rel="canonical"]', 'href')).toBe('https://jake-preview.team-jd.com.au/services')
    expect(head('meta[name="twitter:title"]')).toBe('Coaching Services | Team JD')
  })

  it('marks a page noindex when asked, but never reopens a robots tag the server locked', () => {
    render(<MemoryRouter initialEntries={['/nope']}><Page title="Page Not Found" noindex /></MemoryRouter>)
    expect(head('meta[name="robots"]')).toBe('noindex')
    cleanup()

    document.head.querySelector('meta[name="robots"]').remove()
    document.head.insertAdjacentHTML('beforeend', '<meta name="robots" content="noindex, nofollow" data-locked="true">')
    render(<MemoryRouter initialEntries={['/about']}><Page page="about" /></MemoryRouter>)
    expect(head('meta[name="robots"]')).toBe('noindex, nofollow')
  })

  it('keeps the server\'s built-in page listings identical to the client\'s', () => {
    const server = createRequire(import.meta.url)('../../../server/services/seo.js')
    expect(server.PAGE_META).toEqual(PAGE_META)
  })
})
