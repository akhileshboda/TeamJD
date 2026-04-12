/**
 * Team JD — Browser entrypoint
 * Handles nav, FAQ, results lightbox/filter, and JSON-driven rendering.
 */

document.addEventListener('DOMContentLoaded', async () => {
  initYear();
  initNav();
  initLightbox();

  await hydratePageContent();

  initFAQ();
  initResultsFilter();
});

function initYear() {
  const year = new Date().getFullYear();

  document.querySelectorAll('#year').forEach((node) => {
    node.textContent = year;
  });
}

function getById(id) {
  return document.getElementById(id);
}

async function fetchJSON(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  return response.json();
}

function resolveSitePath(assetPath) {
  if (!assetPath) {
    return '';
  }

  if (/^(?:[a-z]+:|#|\/\/)/i.test(assetPath)) {
    return assetPath;
  }

  return assetPath.startsWith('/') ? assetPath : `/${assetPath.replace(/^\.?\//, '')}`;
}

async function hydratePageContent() {
  const renderTasks = [];

  if (getById('services-container')) {
    renderTasks.push(renderServices('services-container', '/content/services.json', 'cards'));
  }

  if (getById('services-full-container')) {
    renderTasks.push(renderServices('services-full-container', '/content/services.json', 'full'));
  }

  if (getById('testimonials-container')) {
    renderTasks.push(renderTestimonials('testimonials-container', '/content/testimonials.json', 3));
  }

  if (getById('faq-container')) {
    renderTasks.push(renderFAQs('faq-container', '/content/faqs.json'));
  }

  if (getById('results-preview')) {
    renderTasks.push(renderResults('results-preview', '/content/results.json', 3));
  }

  if (getById('results-grid')) {
    renderTasks.push(renderResults('results-grid', '/content/results.json'));
  }

  await Promise.all(renderTasks);
}

async function renderServices(containerId, jsonPath, mode = 'cards') {
  const container = getById(containerId);

  if (!container) {
    return;
  }

  try {
    const services = await fetchJSON(jsonPath);

    if (mode === 'cards') {
      container.innerHTML = services
        .map(
          (service) => `
            <div class="service-card">
              <img class="card-icon" src="${service.includes[0]?.icon ? resolveSitePath(`assets/images/${service.includes[0].icon}`) : ''}" alt="" aria-hidden="true">
              <h3>${service.name}</h3>
              <p>${service.short_description}</p>
              <div class="card-footer">
                ${service.application_required ? '<span class="badge">Application Required</span>' : ''}
                <a href="${service.cta_url}" class="btn btn-outline btn-sm" target="_blank" rel="noopener">${service.cta_text}</a>
              </div>
            </div>
          `
        )
        .join('');
    }

    if (mode === 'full') {
      container.innerHTML = services
        .map(
          (service) => `
            <section class="service-detail section" id="${service.id}">
              <div class="container">
                <div style="max-width: 780px">
                  <span class="accent-line"></span>
                  <h2>${service.name}</h2>
                  <p class="service-tagline" style="font-size:1.125rem; color:var(--color-accent); margin-bottom:var(--space-4); font-weight:600;">${service.tagline}</p>
                  <p style="margin-bottom:var(--space-8); color:var(--color-text-muted);">${service.description}</p>

                  <h3 style="margin-bottom:var(--space-5); font-size:1.125rem;">What's Included</h3>
                  <ul class="includes-list" style="margin-bottom:var(--space-8);">
                    ${service.includes
                      .map(
                        (include) => `
                          <li class="includes-item">
                            <img src="${resolveSitePath(`assets/images/${include.icon}`)}" alt="" aria-hidden="true">
                            <div class="includes-item-text">
                              <strong>${include.title}</strong>
                              <span>${include.description}</span>
                            </div>
                          </li>
                        `
                      )
                      .join('')}
                  </ul>

                  ${
                    service.who_its_for
                      ? `
                        <h3 style="margin-bottom:var(--space-4); font-size:1.125rem;">You're a Great Fit If...</h3>
                        <ul style="display:flex; flex-direction:column; gap:var(--space-2); margin-bottom:var(--space-8);">
                          ${service.who_its_for
                            .map(
                              (item) => `
                                <li style="display:flex; gap:var(--space-3); align-items:flex-start; color:var(--color-text-muted); font-size:0.9375rem;">
                                  <span style="color:var(--color-accent); flex-shrink:0; margin-top:2px;">✓</span>
                                  ${item}
                                </li>
                              `
                            )
                            .join('')}
                        </ul>
                      `
                      : ''
                  }

                  ${
                    service.pricing
                      ? `<p style="color:var(--color-accent); font-weight:700; font-size:1.125rem; margin-bottom:var(--space-6);">${service.pricing}</p>`
                      : ''
                  }

                  ${
                    service.federations
                      ? `
                        <p style="color:var(--color-text-muted); font-size:0.875rem; margin-bottom:var(--space-8);">
                          <strong style="color:var(--color-text);">Supported Federations:</strong> ${service.federations.join(' · ')}
                        </p>
                      `
                      : ''
                  }

                  <div style="display:flex; flex-wrap:wrap; gap:var(--space-4);">
                    <a href="${service.cta_url}" class="btn btn-primary btn-lg" target="_blank" rel="noopener">${service.cta_text}</a>
                    ${service.application_required ? '<span class="badge" style="align-self:center;">Application Required</span>' : ''}
                  </div>
                </div>
              </div>
            </section>
            <hr class="divider" style="margin-inline:var(--container-pad);">
          `
        )
        .join('');
    }
  } catch (error) {
    console.error('renderServices error:', error);
    container.innerHTML =
      '<p style="color:var(--color-text-muted); text-align:center;">Services loading...</p>';
  }
}

async function renderTestimonials(containerId, jsonPath, limit = 0) {
  const container = getById(containerId);

  if (!container) {
    return;
  }

  try {
    let testimonials = await fetchJSON(jsonPath);

    if (limit > 0) {
      testimonials = testimonials.slice(0, limit);
    }

    container.innerHTML = testimonials
      .map(
        (testimonial) => `
          <div class="testimonial-card">
            <div class="testimonial-quote">"</div>
            <p class="testimonial-text">${testimonial.quote}</p>
            <div class="testimonial-meta">
              <div class="testimonial-avatar" aria-hidden="true">${testimonial.author.charAt(0)}</div>
              <div>
                <div class="testimonial-author">${testimonial.author}</div>
                <div class="testimonial-service">${testimonial.service}</div>
              </div>
            </div>
          </div>
        `
      )
      .join('');
  } catch (error) {
    console.error('renderTestimonials error:', error);
  }
}

async function renderFAQs(containerId, jsonPath) {
  const container = getById(containerId);

  if (!container) {
    return;
  }

  try {
    const faqs = await fetchJSON(jsonPath);

    container.innerHTML = faqs
      .map(
        (faq, index) => `
          <div class="faq-item">
            <button class="faq-question" aria-expanded="false" aria-controls="faq-answer-${index}">
              ${faq.question}
              <svg class="faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <div class="faq-answer" id="faq-answer-${index}" role="region">
              <div class="faq-answer-inner">${faq.answer}</div>
            </div>
          </div>
        `
      )
      .join('');
  } catch (error) {
    console.error('renderFAQs error:', error);
  }
}

async function renderResults(containerId, jsonPath, limit = 0) {
  const container = getById(containerId);

  if (!container) {
    return;
  }

  try {
    let results = await fetchJSON(jsonPath);

    if (limit > 0) {
      results = results.slice(0, limit);
    }

    container.innerHTML = results
      .map((result) => {
        const resolvedSrc = resolveSitePath(result.src);

        return `
          <div class="result-card" data-lightbox data-category="${result.category}"
               data-src="${resolvedSrc}" data-alt="${result.alt}" data-caption="${result.caption}"
               role="button" tabindex="0" aria-label="View: ${result.caption}">
            <img src="${resolvedSrc}" alt="${result.alt}" loading="lazy" width="683" height="1024">
            <div class="result-card-overlay">
              <span class="result-caption">${result.caption}</span>
            </div>
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('.result-card[data-lightbox]').forEach((card) => {
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          card.click();
        }
      });
    });
  } catch (error) {
    console.error('renderResults error:', error);
  }
}

function initNav() {
  const hamburger = getById('nav-hamburger');
  const mobileMenu = getById('nav-mobile');

  if (!hamburger || !mobileMenu) {
    return;
  }

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.getAttribute('aria-expanded') === 'true';

    hamburger.setAttribute('aria-expanded', String(!isOpen));
    mobileMenu.classList.toggle('open', !isOpen);
  });

  document.addEventListener('click', (event) => {
    if (!hamburger.contains(event.target) && !mobileMenu.contains(event.target)) {
      hamburger.setAttribute('aria-expanded', 'false');
      mobileMenu.classList.remove('open');
    }
  });

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      hamburger.setAttribute('aria-expanded', 'false');
      mobileMenu.classList.remove('open');
    });
  });
}

function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach((item) => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    if (!question || !answer) {
      return;
    }

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      faqItems.forEach((otherItem) => {
        otherItem.classList.remove('open');

        const otherAnswer = otherItem.querySelector('.faq-answer');
        const otherQuestion = otherItem.querySelector('.faq-question');

        if (otherAnswer) {
          otherAnswer.style.maxHeight = '0';
        }

        if (otherQuestion) {
          otherQuestion.setAttribute('aria-expanded', 'false');
        }
      });

      if (!isOpen) {
        item.classList.add('open');
        answer.style.maxHeight = `${answer.scrollHeight}px`;
        question.setAttribute('aria-expanded', 'true');
      }
    });

    question.setAttribute('aria-expanded', 'false');
  });
}

function initLightbox() {
  const lightbox = getById('lightbox');

  if (!lightbox) {
    return;
  }

  const lightboxImg = lightbox.querySelector('.lightbox-img');
  const lightboxCaption = lightbox.querySelector('.lightbox-caption');
  const closeBtn = lightbox.querySelector('.lightbox-close');

  function openLightbox(src, alt, caption) {
    lightboxImg.src = src;
    lightboxImg.alt = alt;

    if (lightboxCaption) {
      lightboxCaption.textContent = caption || '';
    }

    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';

    if (closeBtn) {
      closeBtn.focus();
    }
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    lightboxImg.src = '';
  }

  document.addEventListener('click', (event) => {
    const card = event.target.closest('.result-card[data-lightbox]');

    if (card) {
      const img = card.querySelector('img');

      openLightbox(
        card.dataset.src || img?.src || '',
        card.dataset.alt || img?.alt || '',
        card.dataset.caption || ''
      );
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeLightbox);
  }

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox.classList.contains('open')) {
      closeLightbox();
    }
  });
}

function initResultsFilter() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const resultCards = document.querySelectorAll('.result-card');
  const noResults = getById('no-results');

  if (!filterBtns.length || !resultCards.length) {
    return;
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.filter;
      let visibleCount = 0;

      filterBtns.forEach((button) => button.classList.remove('active'));
      btn.classList.add('active');

      resultCards.forEach((card) => {
        const cardCategory = card.dataset.category;
        const isVisible = category === 'all' || cardCategory === category;

        card.style.display = isVisible ? '' : 'none';

        if (isVisible) {
          visibleCount += 1;
        }
      });

      if (noResults) {
        noResults.style.display = visibleCount === 0 ? '' : 'none';
      }
    });
  });
}
