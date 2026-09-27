(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollPortfolioSlider = button => {
    const track = document.getElementById(button.dataset.slide);
    if (!track) return;
    const direction = Number(button.dataset.direction) || 1;
    const distance = Math.max(280, track.clientWidth * 0.8);
    const target = Math.max(0, Math.min(track.scrollWidth - track.clientWidth, track.scrollLeft + direction * distance));
    track.scrollLeft = target;
  };
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load ${url}.`);
    return response.json();
  }

  function renderEducation(entries) {
    const container = document.getElementById('education-container');
    if (!container) return;
    container.replaceChildren();
    if (!Array.isArray(entries) || !entries.length) {
      container.appendChild(element('p', 'empty-section', 'Education details will appear here soon.'));
      return;
    }
    entries.forEach((entry, index) => {
      const card = element('article', 'education-card');
      card.dataset.aos = 'fade-up';
      card.dataset.aosDelay = String((index % 3) * 100);
      if (entry.imageUrl) {
        const image = element('img', 'education-image');
        image.src = entry.imageUrl;
        image.alt = `${entry.institution || 'Education'}`;
        image.loading = 'lazy';
        card.appendChild(image);
      }
      const details = element('div', 'education-details');
      const dates = [entry.startYear, entry.endYear].filter(Boolean).join(' – ');
      const heading = element('h3', '', entry.qualification || 'Education');
      const institution = element('p', 'education-institution', entry.institution || '');
      details.append(heading, institution);
      if (entry.fieldOfStudy) details.appendChild(element('p', 'education-field', entry.fieldOfStudy));
      if (dates) details.appendChild(element('span', 'education-dates', dates));
      if (entry.description) details.appendChild(element('p', 'education-description', entry.description));
      card.appendChild(details);
      container.appendChild(card);
    });
  }

  function renderSkillCards(container, skills) {
    container.replaceChildren();
    if (!Array.isArray(skills) || !skills.length) {
      container.appendChild(element('p', 'empty-section', 'Skills will appear here soon.'));
      return;
    }
    skills.forEach((skill, index) => {
      const column = element('div', 'col-md-6 mb-3');
      column.dataset.aos = 'fade-up';
      column.dataset.aosDelay = String((index % 4) * 90);
      const card = element('article', 'skill-card');
      if (skill.imageUrl) {
        const image = element('img', 'skill-image');
        image.src = skill.imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        card.appendChild(image);
      } else {
        card.appendChild(element('span', 'skill-mark', String(skill.name || 'S').slice(0, 1).toUpperCase()));
      }
      const details = element('div', 'skill-details');
      const amount = Math.max(0, Math.min(100, Number(skill.percentage) || 0));
      const heading = element('h3', '', skill.name || 'Skill');
      const percent = element('span', 'skill-percentage', `${amount}%`);
      const bar = element('div', 'skill-bar');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', String(amount));
      const fill = element('div', 'skill-fill');
      fill.style.width = `${amount}%`;
      bar.appendChild(fill);
      details.append(heading, percent, bar);
      card.appendChild(details);
      column.appendChild(card);
      container.appendChild(column);
    });
  }

  function renderGallery(container, records, type) {
    container.replaceChildren();
    if (!Array.isArray(records) || !records.length) {
      container.appendChild(element('p', 'empty-section', `${type === 'certificate' ? 'Certificates' : 'Work'} will appear here soon.`));
      return;
    }
    records.forEach((record, index) => {
      const column = element('div', type === 'certificate' ? 'portfolio-slide certificate-slide' : 'portfolio-slide work-slide');
      column.dataset.aos = 'fade-up';
      column.dataset.aosDelay = String((index % 3) * 100);
      const card = element('article', type === 'certificate' ? 'card certificate-card' : 'card work-card');
      if (record.imageUrl) {
        const image = element('img', type === 'certificate' ? 'certificate-img' : 'card-img-top project-img');
        image.src = record.imageUrl;
        image.alt = record.title || type;
        image.loading = 'lazy';
        if (type === 'certificate') {
          const preview = element('button', 'certificate-preview');
          preview.type = 'button';
          preview.setAttribute('aria-label', `View certificate: ${record.title || 'Certificate'}`);
          preview.appendChild(image);
          card.appendChild(preview);
        } else card.appendChild(image);
      }
      const body = element('div', 'card-body');
      body.appendChild(element('h3', 'card-title', record.title || type));
      body.appendChild(element('p', 'card-text', record.description || ''));
      card.appendChild(body);
      column.appendChild(card);
      container.appendChild(column);
    });
  }

  function setResumeLink(resume) {
    document.querySelectorAll('.resume-download').forEach(link => {
      if (!resume || !(resume.downloadUrl || resume.url)) {
        link.href = '#';
        link.setAttribute('aria-disabled', 'true');
        link.title = 'Upload your CV from the Admin dashboard to enable this download.';
        return;
      }
      link.href = resume.downloadUrl || resume.url;
      if (link.href.startsWith(location.origin)) link.download = resume.filename || 'Himanshu-Saini-CV';
      link.removeAttribute('aria-disabled');
      link.removeAttribute('title');
      link.hidden = false;
    });
    const note = document.getElementById('resumeDownloadNote');
    if (note) note.hidden = Boolean(resume && (resume.downloadUrl || resume.url));
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('.resume-download[aria-disabled="true"]');
    if (link) event.preventDefault();
  });

  function setupIntro() {
    const intro = document.getElementById('portfolioIntro');
    const enter = document.getElementById('enterPortfolio');
    if (!intro || !enter) return;
    document.body.classList.add('intro-locked');
    const leave = () => {
      if (intro.classList.contains('is-leaving')) return;
      intro.classList.add('is-leaving');
      intro.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('intro-locked');
      window.setTimeout(() => { intro.hidden = true; }, reducedMotion ? 0 : 850);
    };
    enter.addEventListener('click', leave);
    intro.addEventListener('keydown', event => {
      if (event.key === 'Escape') leave();
    });
    enter.focus();
  }

  function setupLightbox() {
    const dialog = document.getElementById('certificateLightbox');
    if (!dialog) return;
    const image = document.getElementById('lightboxImage');
    const caption = document.getElementById('lightboxCaption');
    const close = () => { dialog.hidden = true; image.src = ''; };
    document.addEventListener('click', event => {
      const preview = event.target.closest('.certificate-preview');
      if (preview) {
        const source = preview.querySelector('img');
        if (!source) return;
        image.src = source.src;
        image.alt = source.alt;
        caption.textContent = source.alt;
        dialog.hidden = false;
        dialog.querySelector('.lightbox-close').focus();
      } else if (event.target === dialog || event.target.closest('.lightbox-close')) close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !dialog.hidden) close();
    });
  }

  async function init() {
    setupIntro();
    setupLightbox();
    const profileTask = getJson('/api/profile').then(profile => {
      document.querySelectorAll('[data-profile-headline]').forEach(node => {
        node.textContent = profile.headline || 'Web Designer & Developer';
      });
      document.querySelectorAll('[data-profile-summary]').forEach(node => {
        node.textContent = profile.summary || '';
      });
      document.querySelectorAll('[data-profile-story]').forEach(node => {
        node.textContent = profile.story || '';
      });
    });
    const educationTask = getJson('/api/education').then(renderEducation);
    const resumeTask = getJson('/api/resume').then(setResumeLink);
    const results = await Promise.allSettled([profileTask, educationTask, resumeTask]);
    results.filter(result => result.status === 'rejected').forEach(result => console.error('Portfolio content could not be loaded:', result.reason));
    if (window.AOS) window.AOS.refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
