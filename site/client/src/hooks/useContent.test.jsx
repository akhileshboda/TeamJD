import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

function Probe({ useContent }) {
  const { data, loading } = useContent('results')
  if (loading) return <p>loading</p>
  return <p>{data.map((item) => item.caption).join(', ')}</p>
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.resetModules()
  window.history.replaceState(null, '', '/')
})

describe('useContent', () => {
  it('fetches each collection once and shares it', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify([{ caption: 'Live' }]))))
    vi.stubGlobal('fetch', fetchMock)
    const { useContent } = await import('./useContent')
    render(<><Probe useContent={useContent} /><Probe useContent={useContent} /></>)
    expect(await screen.findAllByText('Live')).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/content/results')
  })

  it('in a dashboard preview, shows drafts posted from this origin only', async () => {
    window.history.replaceState(null, '', '/results?cmsPreview=1')
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify([{ caption: 'Live' }])))))
    const { useContent, PREVIEW_MESSAGE } = await import('./useContent')
    render(<Probe useContent={useContent} />)
    await screen.findByText('Live')

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: 'https://evil.example',
        data: { type: PREVIEW_MESSAGE, collections: { results: [{ caption: 'Forged' }] } },
      }))
    })
    expect(screen.getByText('Live')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: PREVIEW_MESSAGE, collections: { results: [{ caption: 'Draft' }] } },
      }))
    })
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })
})
