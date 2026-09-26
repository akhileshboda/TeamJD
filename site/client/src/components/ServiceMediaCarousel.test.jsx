import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ServiceMediaCarousel from './ServiceMediaCarousel'

const service = {
  slug: 'online-coaching',
  name: 'Online Coaching',
  hero_image: 'hero-photo',
  hero_alt: 'Jake reviewing a check-in',
  body_image: 'body-photo',
  body_alt: 'Client training with a coaching plan',
  gallery_images: ['hero-photo', 'body-photo', 'other-photo'],
}

describe('ServiceMediaCarousel', () => {
  it('describes each slide with the alt text written for that image', () => {
    const { container } = render(<ServiceMediaCarousel service={service} />)
    const alts = [...container.querySelectorAll('img')].map((img) => img.getAttribute('alt'))

    expect(alts).toEqual([
      'Jake reviewing a check-in',
      'Client training with a coaching plan',
      'Online Coaching coaching in action',
    ])
  })
})
