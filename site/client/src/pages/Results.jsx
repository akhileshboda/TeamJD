import { useState } from 'react'
import PageHero from '../components/PageHero'
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

          {/* CTA */}
          <SectionReveal delay={0.1}>
            <div
              style={{
                textAlign: 'center',
                marginTop: '3rem',
                padding: '2rem',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border)',
              }}
            >
              <p
                style={{
                  color: 'var(--color-text-muted)',
                  marginBottom: '1rem',
                  fontSize: '1.0625rem',
                }}
              >
                Want your results here?
              </p>
              <a
                href="https://calendly.com/team-jd/15min"
                className="btn btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Book a Free Consult
              </a>
            </div>
          </SectionReveal>
        </div>
      </section>

      <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  )
}
