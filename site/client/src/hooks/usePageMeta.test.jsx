import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { usePageMeta } from './usePageMeta'

const settings = vi.hoisted(() => ({ seo: {} }))
vi.mock('./useSettings', () => ({ useSettings: () => ({ contact: {}, seo: settings.seo }) }))

function Page(props) {
  usePageMeta(props)
  return null
}

afterEach(() => cleanup())

describe('page meta', () => {
  it('uses the page\'s built-in words, then any override from Settings', () => {
    render(<MemoryRouter initialEntries={['/about']}><Page page="about" /></MemoryRouter>)
    expect(document.title).toBe('About Jake Dedert | Team JD')

    settings.seo = { about: { title: 'Meet Jake', description: 'Coach.' } }
    render(<MemoryRouter initialEntries={['/about']}><Page page="about" /></MemoryRouter>)
    expect(document.title).toBe('Meet Jake | Team JD')
    expect(document.head.querySelector('meta[name="description"]').getAttribute('content')).toBe('Coach.')
  })
})
