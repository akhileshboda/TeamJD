import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MediaPicker from './components/MediaPicker'
import PagesSection, { pageKeyOf } from './sections/PagesSection'
import { adminLinkFor } from './links'

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

const photo = { id: 'p1', kind: 'image', url: 'https://cdn/p1.webp', alt: 'Stage photo', originalName: 'stage.jpg', width: 2000, usage: [] }
const video = { id: 'v1', kind: 'video', url: 'https://cdn/v1.mp4', posterUrl: 'https://cdn/v1-poster.webp', alt: '', originalName: 'reel.mov', usage: [] }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('media picker', () => {
  it('only offers files of the kind the spot needs, and hands back the choice', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ items: [photo, video] })))
    const onPick = vi.fn()
    render(<MediaPicker kind="image" title="Choose a photo" onPick={onPick} onClose={() => {}} />)

    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Use this photo' })).toBeDisabled()
    fireEvent.click(options[0])
    fireEvent.click(screen.getByRole('button', { name: 'Use this photo' }))
    expect(onPick).toHaveBeenCalledWith(photo)
  })
})

describe('pages', () => {
  const slots = [
    { id: 'about.portrait', page: 'About', pagePath: '/about', kind: 'image', label: 'Main portrait', hint: 'Portrait', minWidth: 2400,
      builtInUrl: 'https://cdn/jake.webp', record: { rev: 1, status: 'draft', draft: { assetId: 'p1', alt: 'Stage photo' }, published: null }, draftAsset: photo, liveAsset: null },
    { id: 'contact.reel', page: 'Contact', pagePath: '/contact', kind: 'video', label: 'Video reel', hint: 'Video', builtInUrl: null, record: null, draftAsset: null, liveAsset: null },
  ]

  it('lists pages with their unpublished changes, and opens one with its spots', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ slots })))
    render(
      <MemoryRouter initialEntries={['/admin/pages']}>
        <Routes><Route path="/admin/pages/*" element={<PagesSection />} /></Routes>
      </MemoryRouter>,
    )
    const about = await screen.findByRole('link', { name: /About/ })
    expect(within(about).getByText('1 not live')).toBeInTheDocument()
    fireEvent.click(about)

    expect(await screen.findByRole('heading', { name: 'About' })).toBeInTheDocument()
    expect(screen.getByText(/2000 px wide; at least 2400 px/)).toBeInTheDocument()
    expect(screen.getByText('1 change on this page not live yet.')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.jd-preview iframe')).toHaveAttribute('src', '/about?cmsPreview=1'))
  })
})

describe('dashboard links', () => {
  it('points each kind of item at its editor', () => {
    expect(adminLinkFor('results', '7')).toBe('/admin/results/7')
    expect(adminLinkFor('placements', 'about.portrait')).toBe('/admin/pages/about')
    expect(adminLinkFor('placements', 'services.posing-only.hero')).toBe('/admin/pages/posing-only')
    expect(pageKeyOf({ pagePath: '/' })).toBe('home')
    expect(pageKeyOf({ pagePath: '/services/online-coaching' })).toBe('online-coaching')
  })
})
