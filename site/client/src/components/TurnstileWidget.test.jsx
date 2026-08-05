import { createRef } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TurnstileWidget from './TurnstileWidget'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete window.turnstile
})

describe('TurnstileWidget', () => {
  it('loads public config, emits tokens, handles expiry, and resets explicitly', async () => {
    const onToken = vi.fn()
    const onStatus = vi.fn()
    const remove = vi.fn()
    const reset = vi.fn()
    const renderWidget = vi.fn().mockReturnValue('widget-1')
    window.turnstile = { render: renderWidget, remove, reset }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: true, turnstileSiteKey: 'public-site-key' }),
    }))
    const ref = createRef()
    const { unmount } = render(
      <TurnstileWidget ref={ref} onToken={onToken} onStatus={onStatus} />,
    )

    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1))
    const options = renderWidget.mock.calls[0][1]
    expect(options).toMatchObject({
      sitekey: 'public-site-key',
      action: 'general-enquiry',
      theme: 'dark',
      size: 'flexible',
    })

    options.callback('single-use-token')
    expect(onToken).toHaveBeenLastCalledWith('single-use-token')
    options['expired-callback']()
    expect(onToken).toHaveBeenLastCalledWith('')
    expect(onStatus).toHaveBeenLastCalledWith(expect.stringMatching(/expired/i))

    ref.current.reset()
    expect(reset).toHaveBeenCalledWith('widget-1')
    unmount()
    expect(remove).toHaveBeenCalledWith('widget-1')
  })

  it('fails closed when enquiry delivery is unavailable', async () => {
    const onStatus = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ available: false, turnstileSiteKey: null }),
    }))

    render(<TurnstileWidget onToken={vi.fn()} onStatus={onStatus} />)

    expect(await screen.findByText('Security check unavailable')).toBeInTheDocument()
    expect(onStatus).toHaveBeenCalledWith(expect.stringMatching(/temporarily unavailable/i))
  })
})
