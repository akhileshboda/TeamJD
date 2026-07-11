import PageHero from '../components/PageHero'
import CTABanner from '../components/CTABanner'
import ServiceGlassCard from '../components/ServiceGlassCard'
import { StaggerContainer, StaggerItem } from '../components/SectionReveal'
import { useJSON } from '../hooks/useJSON'

export default function Services() {
  const { data: services } = useJSON('/content/services.json')

  return (
    <>
      <PageHero
        eyebrow="Coaching Packages"
        title="Pick Your Path."
        subtitle="Personalised coaching for stage, training, and presentation — pick the path that matches your next move."
      />

      <section className="services-hub" aria-label="Coaching services">
        <div className="container services-hub-inner">
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

        <CTABanner
          sectionClassName="services-final-cta"
          analyticsLocation="services_final_cta"
          eyebrow="Not Sure Yet?"
          title="Find Your Perfect Fit."
          description="Answer a few quick questions — or get in touch and Jake will help you choose the right path."
          actions={[
            {
              label: 'Take the Service Quiz',
              type: 'button',
              variant: 'primary',
              analyticsId: 'service_quiz',
            },
            {
              label: 'Get in Touch',
              to: '/contact',
              variant: 'secondary',
              analyticsId: 'get_in_touch',
            },
          ]}
        />
      </section>
    </>
  )
}
