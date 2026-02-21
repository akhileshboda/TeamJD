/**
 * Team JD — Content Renderer
 * Fetches JSON content and renders into DOM containers.
 * Path resolution: relative to the calling page's location.
 */

/* ── Utility ─────────────────────────────────────────────── */
async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}

function $(id) {
  return document.getElementById(id);
}

/* ── Services ────────────────────────────────────────────── */
export async function renderServices(containerId, jsonPath, mode = 'cards') {
  const container = $(containerId);
  if (!container) return;

  try {
    const services = await fetchJSON(jsonPath);

    if (mode === 'cards') {
      container.innerHTML = services.map(s => `
        <div class="service-card">
          <img class="card-icon" src="${s.includes[0]?.icon ? `/assets/images/${s.includes[0].icon}` : ''}" alt="" aria-hidden="true">
          <h3>${s.name}</h3>
          <p>${s.short_description}</p>
          <div class="card-footer">
            ${s.application_required ? '<span class="badge">Application Required</span>' : '<span></span>'}
            <a href="${s.cta_url}" class="btn btn-outline btn-sm" target="_blank" rel="noopener">${s.cta_text}</a>
          </div>
        </div>
      `).join('');
    }

    if (mode === 'full') {
      container.innerHTML = services.map(s => `
        <section class="service-detail section" id="${s.id}">
          <div class="container">
            <div style="max-width: 780px">
              <span class="accent-line"></span>
              <h2>${s.name}</h2>
              <p class="service-tagline" style="font-size:1.125rem; color:var(--color-accent); margin-bottom:var(--space-4); font-weight:600;">${s.tagline}</p>
              <p style="margin-bottom:var(--space-8); color:var(--color-text-muted);">${s.description}</p>

              <h3 style="margin-bottom:var(--space-5); font-size:1.125rem;">What's Included</h3>
              <ul class="includes-list" style="margin-bottom:var(--space-8);">
                ${s.includes.map(inc => `
                  <li class="includes-item">
                    <img src="/assets/images/${inc.icon}" alt="" aria-hidden="true">
                    <div class="includes-item-text">
                      <strong>${inc.title}</strong>
                      <span>${inc.description}</span>
                    </div>
                  </li>
                `).join('')}
              </ul>

              ${s.who_its_for ? `
                <h3 style="margin-bottom:var(--space-4); font-size:1.125rem;">You're a Great Fit If...</h3>
                <ul style="display:flex; flex-direction:column; gap:var(--space-2); margin-bottom:var(--space-8);">
                  ${s.who_its_for.map(item => `
                    <li style="display:flex; gap:var(--space-3); align-items:flex-start; color:var(--color-text-muted); font-size:0.9375rem;">
                      <span style="color:var(--color-accent); flex-shrink:0; margin-top:2px;">✓</span>
                      ${item}
                    </li>
                  `).join('')}
                </ul>
              ` : ''}

              ${s.pricing ? `<p style="color:var(--color-accent); font-weight:700; font-size:1.125rem; margin-bottom:var(--space-6);">${s.pricing}</p>` : ''}

              ${s.federations ? `
                <p style="color:var(--color-text-muted); font-size:0.875rem; margin-bottom:var(--space-8);">
                  <strong style="color:var(--color-text);">Supported Federations:</strong> ${s.federations.join(' · ')}
                </p>
              ` : ''}

              <div style="display:flex; flex-wrap:wrap; gap:var(--space-4);">
                <a href="${s.cta_url}" class="btn btn-primary btn-lg" target="_blank" rel="noopener">${s.cta_text}</a>
                ${s.application_required ? '<span class="badge" style="align-self:center;">Application Required</span>' : ''}
              </div>
            </div>
          </div>
        </section>
        <hr class="divider" style="margin-inline:var(--container-pad);">
      `).join('');
    }
  } catch (err) {
    console.error('renderServices error:', err);
    container.innerHTML = '<p style="color:var(--color-text-muted); text-align:center;">Services loading...</p>';
  }
}

/* ── Testimonials ────────────────────────────────────────── */
export async function renderTestimonials(containerId, jsonPath, limit = 0) {
  const container = $(containerId);
  if (!container) return;

  try {
    let testimonials = await fetchJSON(jsonPath);
    if (limit > 0) testimonials = testimonials.slice(0, limit);

    container.innerHTML = testimonials.map(t => `
      <div class="testimonial-card">
        <div class="testimonial-quote">"</div>
        <p class="testimonial-text">${t.quote}</p>
        <div class="testimonial-meta">
          <div class="testimonial-avatar" aria-hidden="true">${t.author.charAt(0)}</div>
          <div>
            <div class="testimonial-author">${t.author}</div>
            <div class="testimonial-service">${t.service}</div>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('renderTestimonials error:', err);
  }
}

/* ── FAQs ────────────────────────────────────────────────── */
export async function renderFAQs(containerId, jsonPath) {
  const container = $(containerId);
  if (!container) return;

  try {
    const faqs = await fetchJSON(jsonPath);

    container.innerHTML = faqs.map((faq, i) => `
      <div class="faq-item">
        <button class="faq-question" aria-expanded="false" aria-controls="faq-answer-${i}">
          ${faq.question}
          <svg class="faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <div class="faq-answer" id="faq-answer-${i}" role="region">
          <div class="faq-answer-inner">${faq.answer}</div>
        </div>
      </div>
    `).join('');

    // Re-init FAQ accordion after render
    if (window.initFAQAfterRender) window.initFAQAfterRender();
    else {
      // Inline re-init
      container.querySelectorAll('.faq-item').forEach(item => {
        const q = item.querySelector('.faq-question');
        const a = item.querySelector('.faq-answer');
        q.addEventListener('click', () => {
          const isOpen = item.classList.contains('open');
          container.querySelectorAll('.faq-item').forEach(other => {
            other.classList.remove('open');
            const otherA = other.querySelector('.faq-answer');
            if (otherA) otherA.style.maxHeight = '0';
            const otherQ = other.querySelector('.faq-question');
            if (otherQ) otherQ.setAttribute('aria-expanded', 'false');
          });
          if (!isOpen) {
            item.classList.add('open');
            a.style.maxHeight = a.scrollHeight + 'px';
            q.setAttribute('aria-expanded', 'true');
          }
        });
      });
    }
  } catch (err) {
    console.error('renderFAQs error:', err);
  }
}

/* ── Results ─────────────────────────────────────────────── */
export async function renderResults(containerId, jsonPath, limit = 0) {
  const container = $(containerId);
  if (!container) return;

  try {
    let results = await fetchJSON(jsonPath);
    if (limit > 0) results = results.slice(0, limit);

    container.innerHTML = results.map(r => `
      <div class="result-card" data-lightbox data-category="${r.category}"
           data-src="${r.src}" data-alt="${r.alt}" data-caption="${r.caption}"
           role="button" tabindex="0" aria-label="View: ${r.caption}">
        <img src="${r.src}" alt="${r.alt}" loading="lazy" width="683" height="1024">
        <div class="result-card-overlay">
          <span class="result-caption">${r.caption}</span>
        </div>
      </div>
    `).join('');

    // Keyboard support for lightbox
    container.querySelectorAll('.result-card[data-lightbox]').forEach(card => {
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  } catch (err) {
    console.error('renderResults error:', err);
  }
}
