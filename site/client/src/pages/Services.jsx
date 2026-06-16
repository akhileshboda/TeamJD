import PageHero from '../components/PageHero'
import CTABanner from '../components/CTABanner'
import ServiceCard from '../components/ServiceCard'
import { StaggerContainer, StaggerItem } from '../components/SectionReveal'
import { useJSON } from '../hooks/useJSON'

export default function Services() {
  const { data: services } = useJSON('/content/services.json')

  return (
    <>
      <PageHero
        eyebrow="Coaching Packages"
        title="Pick Your Path."
        subtitle="Every service is 100% personalised to your goals, your body, and your timeline. No templates. No copy-paste programs. No shortcuts."
      />

      <section className="section" aria-label="Coaching services">
        <div className="container">
          {services ? (
            <StaggerContainer className="grid-service-tiles">
              {services.map((service) => (
                <StaggerItem key={service.id}>
                  <ServiceCard service={service} />
                </StaggerItem>
              ))}
            </StaggerContainer>
          ) : (
            <div className="grid-service-tiles">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="service-tile service-tile--skeleton"
                  aria-hidden="true"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <CTABanner
        title="Not Sure Which Is Right for You?"
        description="Book a free 15-minute consultation. Jake will help you figure out the best path based on your goals, experience, and lifestyle."
        secondaryLabel="Get in Touch"
        secondaryTo="/contact"
        eyebrow=""
      />
    </>
  )
}
