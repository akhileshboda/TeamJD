import PageHero from '../components/PageHero'
import ServiceGlassCard from '../components/ServiceGlassCard'
import ServiceFinderBanner from '../components/ServiceFinderBanner'
import { StaggerContainer, StaggerItem } from '../components/SectionReveal'
import { useJSON } from '../hooks/useJSON'

export default function Services() {
  const { data: services } = useJSON('/content/services.json')

  return (
    <>
      <PageHero
        eyebrow="Coaching Packages"
        title="Pick Your Path."
        subtitle="Based in Adelaide and coaching without borders — connect with Jake in South Australia or work with him online from anywhere in the world."
      />

      <section className="services-hub" aria-label="Coaching services">
        <div className="container services-hub-inner">
          <ServiceFinderBanner />

          {services ? (
            <StaggerContainer className="services-glass-grid" inView={false}>
              {services.map((service) => (
                <StaggerItem key={service.id}>
                  <ServiceGlassCard service={service} />
                </StaggerItem>
              ))}
            </StaggerContainer>
          ) : (
            <div className="services-glass-grid" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="service-glass-card service-glass-card--skeleton" />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
