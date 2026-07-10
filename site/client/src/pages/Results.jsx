import { useState } from 'react'
import PageHero from '../components/PageHero'
import CTABanner from '../components/CTABanner'
import ResultCard from '../components/ResultCard'
import Lightbox from '../components/Lightbox'
import SectionReveal, { StaggerContainer, StaggerItem } from '../components/SectionReveal'
import { useJSON } from '../hooks/useJSON'

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Competition', value: 'competition' },
  { label: 'Posing', value: 'posing' },
  { label: 'Training', value: 'training' },
]

export default function Results() {
  const { data: results } = useJSON('/content/results.json')
  const [activeFilter, setActiveFilter] = useState('all')
  const [lightboxImage, setLightboxImage] = useState(null)

  const filtered = results?.filter(
    (r) => activeFilter === 'all' || r.category === activeFilter
  ) || []

  return (
    <>
      <PageHero
        eyebrow="Client Results"
        title="Proof in the Prep."
        subtitle="Real clients. Real commitment. Real results. Every photo represents a journey — from the first session to standing on stage."
      />

      <section className="section" aria-labelledby="results-heading">
        <div className="container">
          {/* Filter Buttons */}
          <SectionReveal>
            <div className="filter-group" role="group" aria-label="Filter results by category">
              {FILTERS.map(({ label, value }) => (
                <button
                  key={value}
                  className={`filter-btn${activeFilter === value ? ' active' : ''}`}
                  onClick={() => setActiveFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </SectionReveal>

          {/* Results Grid — only mount once data is ready so IntersectionObserver fires on a non-zero-height element */}
          {results && (
            <StaggerContainer className="grid-results">
              {filtered.map((result) => (
                <StaggerItem key={result.id}>
                  <ResultCard result={result} onOpen={setLightboxImage} />
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}

          {filtered.length === 0 && results && (
            <p
              style={{
                textAlign: 'center',
                color: 'var(--color-text-muted)',
                padding: '3rem 0',
              }}
            >
              No results in this category yet.
            </p>
          )}

        </div>
      </section>

      <CTABanner
        analyticsLocation="results_final_cta"
        eyebrow="Your Result Starts Here"
        title="Ready to build your own result?"
        description="Explore the coaching options, find the level of support that fits your goal, and take the next step with a clear plan."
        actions={[
          {
            label: 'Explore Services',
            to: '/services',
            variant: 'primary',
            analyticsId: 'explore_services',
          },
          {
            label: 'Book a Free Consult',
            href: 'https://calendly.com/team-jd/15min',
            variant: 'secondary',
            analyticsId: 'book_consult',
          },
        ]}
      />

      <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  )
}
