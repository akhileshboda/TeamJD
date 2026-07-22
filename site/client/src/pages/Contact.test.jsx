import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
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

afterEach(() => cleanup())

function renderContact() {
  return render(
    <MemoryRouter>
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
      expect(link).toHaveAttribute('href', '/services#find-your-fit')
    })
  })

  it('keeps the enquiry form accessible and configured for the current email flow', () => {
    renderContact()

    const form = screen.getByRole('form', { name: 'Contact Jake' })
    expect(form).toHaveAttribute('action', 'mailto:jake@team-jd.com.au')
    expect(form).toHaveAttribute('method', 'POST')
    expect(form).toHaveAttribute('enctype', 'text/plain')

    expect(screen.getByLabelText('First Name')).toBeRequired()
    expect(screen.getByLabelText('Last Name')).not.toBeRequired()
    expect(screen.getByLabelText('Email Address')).toBeRequired()
    expect(screen.getByLabelText('Your Message')).toBeRequired()

    const serviceSelect = screen.getByLabelText('Interested In')
    expect(within(serviceSelect).getByRole('option', { name: 'Competition Preparation' })).toBeInTheDocument()
    expect(within(serviceSelect).getByRole('option', { name: 'General Question' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send enquiry/i })).toHaveAttribute('type', 'submit')
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
      ['Jake in an off-duty mirror portrait', 'gallery-jake-off-duty-facebook-2019'],
    ]

    socialAssets.forEach(([alt, asset]) => {
      expect(screen.getByAltText(alt)).toHaveAttribute('src', `/api/assets/${asset}`)
    })

    expect(screen.getByRole('region', { name: 'Recent Team JD social posts' })).toBeInTheDocument()
  })
})
