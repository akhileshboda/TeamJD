import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import PageViewTracker from './PageViewTracker'

let navigate
function Harness() {
  navigate = useNavigate()
  return <PageViewTracker />
}

function payloads(beacon) {
  return beacon.mock.calls.map(([, blob]) => blob)
}

describe('page view tracking', () => {
  let beacon

  beforeEach(() => {
    window.sessionStorage.clear()
    beacon = vi.fn(() => true)
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true })
    Object.defineProperty(document, 'referrer', { value: 'https://l.instagram.com/', configurable: true })
  })

  afterEach(() => cleanup())

  it('sends one beacon per page, with the referrer only on the first page of a visit', async () => {
    render(
      <MemoryRouter initialEntries={['/?utm_source=ig']}>
        <Harness />
      </MemoryRouter>,
    )
    act(() => navigate('/results'))
    act(() => navigate('/results'))

    const sent = await Promise.all(payloads(beacon).map((blob) => blob.text().then(JSON.parse)))
    expect(sent).toEqual([
      { path: '/', visitStart: true, referrer: 'https://l.instagram.com/', utmSource: 'ig' },
      { path: '/results', visitStart: false },
    ])
  })

  it('skips dashboard previews and automated browsers', () => {
    render(
      <MemoryRouter initialEntries={['/results?cmsPreview=1']}>
        <PageViewTracker />
      </MemoryRouter>,
    )
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true })
    render(
      <MemoryRouter initialEntries={['/about']}>
        <PageViewTracker />
      </MemoryRouter>,
    )
    expect(beacon).not.toHaveBeenCalled()
  })
})
