// ── Cloudflare Turnstile (Site Key) ──
// Hier deinen öffentlichen Site-Key aus dem Cloudflare Dashboard einfügen.
// (Der Secret-Key gehört NICHT hierher, sondern als Vercel Env-Var.)
const TURNSTILE_SITE_KEY = '0x4AAAAAAC-8e0-TSwWm797j';

// ── Language ──
const lang = localStorage.getItem('tks-language') || 'de';
document.documentElement.setAttribute('data-lang', lang);

// ── Scroll Progress Bar ──
const progressBar = document.createElement('div');
progressBar.className = 'scroll-progress';
document.body.prepend(progressBar);

window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const total = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.width = total > 0 ? (scrolled / total * 100) + '%' : '0%';

  // Header shadow on scroll
  const header = document.querySelector('.header');
  if (header) header.classList.toggle('scrolled', scrolled > 10);
}, { passive: true });

function toggleLanguage() {
  const current = document.documentElement.getAttribute('data-lang');
  const next = current === 'de' ? 'en' : 'de';
  document.documentElement.setAttribute('data-lang', next);
  localStorage.setItem('tks-language', next);
  document.documentElement.lang = next;
  document.querySelectorAll('.lang-label').forEach(el => el.textContent = next.toUpperCase());
}

// ── Mobile Menu ──
function toggleMobileMenu() {
  document.getElementById('mobile-menu').classList.toggle('open');
}

// ── Active Nav ──
document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.header-nav a, .mobile-menu a').forEach(a => {
    const href = a.getAttribute('href').replace(/\/$/, '') || '/';
    if (path === href || (href !== '/' && path.startsWith(href))) {
      a.classList.add('active');
    }
  });

  // Set lang labels
  const currentLang = document.documentElement.getAttribute('data-lang');
  document.querySelectorAll('.lang-label').forEach(el => el.textContent = currentLang.toUpperCase());

  // Cookie banner
  if (!localStorage.getItem('tks-cookie-consent')) {
    setTimeout(() => {
      const banner = document.getElementById('cookie-banner');
      if (banner) banner.classList.add('visible');
    }, 1000);
  }

  // Stagger delays for grid children
  document.querySelectorAll('.services-grid, .trust-grid, .values-grid, .testimonials-grid, .stats-grid, .usp-grid').forEach(grid => {
    grid.querySelectorAll(':scope > *').forEach((child, i) => {
      child.classList.add('animate');
      child.style.transitionDelay = (i * 0.1) + 's';
    });
  });

  // Counter animation for stat numbers
  function animateCounter(el) {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const duration = 1800;
    const start = performance.now();
    const update = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.floor(target * eased);
      // Format with locale thousands separator
      el.textContent = prefix + value.toLocaleString('de-DE') + suffix;
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  // Scroll animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        // Trigger counter if applicable
        if (e.target.classList.contains('stat') || e.target.closest('.stat')) {
          const counter = (e.target.classList.contains('stat') ? e.target : e.target.closest('.stat')).querySelector('[data-count]');
          if (counter && !counter.dataset.animated) {
            counter.dataset.animated = '1';
            animateCounter(counter);
          }
        }
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.animate, .animate-left, .animate-right, .animate-scale').forEach(el => observer.observe(el));

  // Also observe stats for counter
  document.querySelectorAll('.stat').forEach(el => observer.observe(el));

  // ── Init protected forms (honeypot + Turnstile + timestamp) ──
  const protectedForms = document.querySelectorAll(
    'form[onsubmit*="submitContactForm"], form[onsubmit*="submitQuoteForm"]'
  );
  if (protectedForms.length) {
    if (!document.getElementById('cf-turnstile-script')) {
      const s = document.createElement('script');
      s.id = 'cf-turnstile-script';
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    }
    protectedForms.forEach(form => {
      form.dataset.openedAt = Date.now();
      // Honeypot field — invisible to humans, bots fill it
      const hp = document.createElement('input');
      hp.type = 'text'; hp.name = 'website'; hp.tabIndex = -1;
      hp.autocomplete = 'off'; hp.className = 'hp-field';
      hp.setAttribute('aria-hidden', 'true');
      form.appendChild(hp);
      // Turnstile widget container
      const t = document.createElement('div');
      t.className = 'cf-turnstile';
      t.dataset.sitekey = TURNSTILE_SITE_KEY;
      t.dataset.theme = 'light';
      t.style.marginTop = '1rem';
      const submit = form.querySelector('button[type=submit]');
      if (submit) submit.parentNode.insertBefore(t, submit);
      else form.appendChild(t);
    });
  }
});

function acceptCookies() {
  localStorage.setItem('tks-cookie-consent', 'accepted');
  document.getElementById('cookie-banner').classList.remove('visible');
}
function declineCookies() {
  localStorage.setItem('tks-cookie-consent', 'declined');
  document.getElementById('cookie-banner').classList.remove('visible');
}

// ── Contact / Quote Form Submit ──
function submitContactForm(e) { return submitProtectedForm(e, 'contact'); }
function submitQuoteForm(e)   { return submitProtectedForm(e, 'quote');   }

async function submitProtectedForm(e, type) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  const orig = btn.innerHTML;

  const showError = (msg) => {
    let errDiv = form.querySelector('.form-error');
    if (!errDiv) { errDiv = document.createElement('div'); errDiv.className = 'form-error'; form.appendChild(errDiv); }
    errDiv.textContent = msg;
    btn.disabled = false;
    btn.innerHTML = orig;
    if (window.turnstile) try { window.turnstile.reset(); } catch {}
  };

  // Get Turnstile token (Cloudflare auto-injects this hidden input)
  const tokenEl = form.querySelector('input[name="cf-turnstile-response"]');
  const token = tokenEl ? tokenEl.value : '';
  if (!token) {
    showError('Bitte warten Sie kurz, bis die Sicherheitsprüfung geladen ist, und versuchen Sie es erneut.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> ...';

  const formData = Object.fromEntries(new FormData(form));
  const hp = formData.website || '';
  delete formData.website;
  delete formData['cf-turnstile-response'];

  try {
    const resp = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type, data: formData, token, hp,
        openedAt: Number(form.dataset.openedAt) || 0,
      }),
    });
    const result = await resp.json().catch(() => null);
    if (!resp.ok || !result || !result.ok) {
      const detail = (result && result.error) ? result.error : `HTTP ${resp.status}`;
      throw new Error(detail);
    }

    const success = type === 'contact'
      ? { title: 'Nachricht gesendet!', text: 'Vielen Dank! Wir melden uns in Kürze bei Ihnen.' }
      : { title: 'Anfrage gesendet!',  text: 'Vielen Dank! Wir senden Ihnen schnellstmöglich ein Angebot.' };

    form.innerHTML = `<div class="form-success"><div class="form-success-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></div><h3 style="font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:1.5rem;text-transform:uppercase;margin-bottom:1rem">${success.title}</h3><p style="color:var(--zinc-600)">${success.text}</p></div>`;
  } catch (err) {
    showError(err && err.message ? err.message : 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
  }
}
