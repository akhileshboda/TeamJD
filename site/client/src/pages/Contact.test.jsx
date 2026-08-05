import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Contact from './Contact'

vi.mock('../components/SectionReveal', () => ({
  default: ({ children, className = '' }) => <div className={className}>{children}</div>,
}))

vi.mock('../components/ContactMediaReel', () => ({
  default: ({ youtubeId, poster, credit, creditHref }) => (
    <figure
      data-testid="contact-media-reel"
      data-youtube-id={youtubeId}
      data-credit={credit}
      data-credit-href={creditHref}
    >
      <img data-testid="contact-media-poster" src={poster} alt="" />
    </figure>
  ),
}))

vi.mock('../hooks/useAssets', () => ({
  useAssets: () => (assetPath) => assetPath,
}))

vi.mock('../components/TurnstileWidget', async () => {
  const React = await import('react')
  return {
    default: React.forwardRef(function MockTurnstile({ onToken }, ref) {
      React.useEffect(() => onToken('verified-turnstile-token'), [onToken])
      React.useImperativeHandle(ref, () => ({
        reset: () => onToken('verified-turnstile-token'),
      }))
      return <div data-testid="turnstile-widget" />
    }),
  }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderContact(initialEntry = '/contact') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Contact />
    </MemoryRouter>,
  )
}

describe('Contact page route chooser', () => {
  it('renders both entry routes and the four service destinations', () => {
    const { container } = renderContact()

    expect(
      screen.getByRole('heading', { name: 'What are you working toward?' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Explore coaching/i })).toHaveAttribute(
      'href',
      '#contact-services',
    )
    expect(screen.getByRole('link', { name: /Ask Jake/i })).toHaveAttribute(
      'href',
      '#contact-enquiry',
    )
    expect(container.querySelector('#contact-services')).toBeInTheDocument()
    expect(container.querySelector('#contact-enquiry')).toBeInTheDocument()

    const serviceDestinations = [
      ['Competition Preparation', '/services/competition-preparation'],
      ['Online Coaching', '/services/online-coaching'],
      ['Personal Training', '/services/personal-training'],
      ['Posing', '/services/posing-only'],
    ]

    serviceDestinations.forEach(([name, href]) => {
      expect(screen.getByRole('link', { name: new RegExp(name, 'i') })).toHaveAttribute(
        'href',
        href,
      )
    })

    screen.getAllByRole('link', { name: /Find Your Fit/i }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/contact#find-your-fit')
    })
  })

  it('keeps the enquiry form accessible and removes the local email-client flow', async () => {
    renderContact()

    const form = screen.getByRole('form', { name: 'Contact Jake' })
    expect(form).not.toHaveAttribute('action')
    expect(form).not.toHaveAttribute('method')

    expect(screen.getByLabelText('First Name')).toBeRequired()
    expect(screen.getByLabelText('Last Name')).not.toBeRequired()
    expect(screen.getByLabelText('Email Address')).toBeRequired()
    expect(screen.getByLabelText('Your Message')).toBeRequired()

    const serviceSelect = screen.getByLabelText('Interested In')
    expect(within(serviceSelect).getByRole('option', { name: 'Competition Preparation' })).toBeInTheDocument()
    expect(within(serviceSelect).getByRole('option', { name: 'General Question' })).toBeInTheDocument()
    const button = screen.getByRole('button', { name: /Send enquiry/i })
    expect(button).toHaveAttribute('type', 'submit')
    await waitFor(() => expect(button).toBeEnabled())
    expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument()
    expect(screen.getByText(/Resend delivers your enquiry/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
  })

  it('posts the expected request and clears fields only after success', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })
    vi.stubGlobal('fetch', request)
    renderContact('/contact?service=online-coaching')

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Akhil' } })
    fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Boda' } })
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'akhileshboda@outlook.com' },
    })
    fireEvent.change(screen.getByLabelText('Your Message'), {
      target: { value: 'I would like some clarity about coaching.' },
    })

    await waitFor(() => expect(screen.getByRole('button', { name: /Send enquiry/i })).toBeEnabled())
    fireEvent.submit(screen.getByRole('form', { name: 'Contact Jake' }))

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    const [url, options] = request.mock.calls[0]
    const payload = JSON.parse(options.body)
    expect(url).toBe('/api/enquiries')
    expect(options.method).toBe('POST')
    expect(payload).toMatchObject({
      firstName: 'Akhil',
      lastName: 'Boda',
      email: 'akhileshboda@outlook.com',
      service: 'online-coaching',
      message: 'I would like some clarity about coaching.',
      website: '',
      turnstileToken: 'verified-turnstile-token',
    })
    expect(payload.submissionId).toMatch(/^[0-9a-f-]{36}$/i)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/confirmation is on its way/i))
    expect(screen.getByLabelText('First Name')).toHaveValue('')
    expect(screen.getByLabelText('Email Address')).toHaveValue('')
  })

  it('shows pending state and preserves entered data after a delivery error', async () => {
    let resolveRequest
    const request = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveRequest = resolve
    }))
    vi.stubGlobal('fetch', request)
    renderContact()

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Akhil' } })
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'akhileshboda@outlook.com' },
    })
    fireEvent.change(screen.getByLabelText('Your Message'), {
      target: { value: 'Please keep this message after an error.' },
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /Send enquiry/i })).toBeEnabled())
    fireEvent.submit(screen.getByRole('form', { name: 'Contact Jake' }))

    expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled()
    resolveRequest({
      ok: false,
      json: async () => ({ error: { message: 'Enquiries are temporarily at capacity.' } }),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily at capacity')
    expect(screen.getByLabelText('First Name')).toHaveValue('Akhil')
    expect(screen.getByLabelText('Email Address')).toHaveValue('akhileshboda@outlook.com')
    expect(screen.getByLabelText('Your Message')).toHaveValue('Please keep this message after an error.')
  })

  it('reuses an idempotency reference only while the failed payload is unchanged', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Delivery failed.' } }),
    })
    vi.stubGlobal('fetch', request)
    renderContact()

    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Akhil' } })
    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'akhileshboda@outlook.com' },
    })
    fireEvent.change(screen.getByLabelText('Your Message'), {
      target: { value: 'Original message.' },
    })
    const form = screen.getByRole('form', { name: 'Contact Jake' })
    const submit = () => fireEvent.submit(form)

    await waitFor(() => expect(screen.getByRole('button', { name: /Send enquiry/i })).toBeEnabled())
    submit()
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    const firstId = JSON.parse(request.mock.calls[0][1].body).submissionId

    await waitFor(() => expect(screen.getByRole('button', { name: /Send enquiry/i })).toBeEnabled())
    submit()
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    const retryId = JSON.parse(request.mock.calls[1][1].body).submissionId
    expect(retryId).toBe(firstId)

    fireEvent.change(screen.getByLabelText('Your Message'), {
      target: { value: 'Changed after the failed delivery.' },
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /Send enquiry/i })).toBeEnabled())
    submit()
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3))
    const changedId = JSON.parse(request.mock.calls[2][1].body).submissionId
    expect(changedId).not.toBe(firstId)
  })

  it('preselects the unsure enquiry from a valid finder handoff and rejects unknown values', () => {
    const { unmount } = renderContact('/contact?service=unsure#contact-enquiry')

    expect(screen.getByLabelText('Interested In')).toHaveValue('unsure')

    unmount()
    renderContact('/contact?service=not-a-service')
    expect(screen.getByLabelText('Interested In')).toHaveValue('')
  })

  it('keeps both contact social links external and secure', () => {
    renderContact()

    const instagram = screen.getByRole('link', { name: /Instagram @jakededert/i })
    const facebook = screen.getByRole('link', { name: /^Facebook/i })

    expect(instagram).toHaveAttribute('href', 'https://www.instagram.com/jakededert/')
    expect(facebook).toHaveAttribute(
      'href',
      'https://www.facebook.com/p/Jake-Dedert-Team-JD-Coaching-100063678694779/',
    )

    ;[instagram, facebook].forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  it('resolves the contact reel and social images through mapped asset keys', () => {
    renderContact()

    expect(screen.getByTestId('contact-media-reel')).toHaveAttribute(
      'data-youtube-id',
      'GbQomqb28os',
    )
    expect(screen.getByTestId('contact-media-reel')).toHaveAttribute('data-credit', 'Nike')
    expect(screen.getByTestId('contact-media-reel')).toHaveAttribute(
      'data-credit-href',
      'https://www.youtube.com/watch?v=GbQomqb28os',
    )
    expect(screen.getByTestId('contact-media-poster')).toHaveAttribute(
      'src',
      '/api/assets/video-contact-athlete-reel-poster',
    )
    const socialAssets = [
      ['Jake standing with another physique competitor on stage', 'gallery-social-facebook-stage-2022'],
      ['Jake posing during an industrial-location fitness photoshoot', 'gallery-social-facebook-editorial-2022'],
      ['Jake with two competitors at an ICN South Australia event', 'gallery-social-facebook-coaching-2020'],
      ['Side profile of Jake training in a gym', 'gallery-social-facebook-training-detail-2019'],
      ['Jake posing for a studio physique portrait', 'gallery-social-facebook-studio-portrait-2019'],
      ['Jake standing among strength equipment in a gym', 'gallery-social-facebook-gym-2019'],
      ['Jake documenting his training progress in the gym', 'gallery-jake-training-facebook-2019'],
    ]

    socialAssets.forEach(([alt, asset]) => {
      expect(screen.getByAltText(alt)).toHaveAttribute('src', `/api/assets/${asset}`)
    })

    expect(screen.getByRole('region', { name: 'Recent Team JD social posts' })).toBeInTheDocument()
    expect(screen.queryByText(/Facebook · \d/i)).not.toBeInTheDocument()
  })
})
