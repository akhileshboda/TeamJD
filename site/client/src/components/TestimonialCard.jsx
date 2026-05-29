export default function TestimonialCard({ testimonial }) {
  const initial = testimonial.author?.charAt(0) || '?'

  return (
    <div className="testimonial-card">
      <div className="testimonial-quote">&ldquo;</div>
      <p className="testimonial-text">{testimonial.quote}</p>
      <div className="testimonial-meta">
        <div className="testimonial-avatar" aria-hidden="true">
          {initial}
        </div>
        <div>
          <div className="testimonial-author">{testimonial.author}</div>
          <div className="testimonial-service">{testimonial.service}</div>
        </div>
      </div>
    </div>
  )
}
