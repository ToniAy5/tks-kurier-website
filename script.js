// ── Language ──
const lang = localStorage.getItem('tks-language') || 'de';
document.documentElement.setAttribute('data-lang', lang);

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

  // Scroll animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.animate').forEach(el => observer.observe(el));
});

function acceptCookies() {
  localStorage.setItem('tks-cookie-consent', 'accepted');
  document.getElementById('cookie-banner').classList.remove('visible');
}
function declineCookies() {
  localStorage.setItem('tks-cookie-consent', 'declined');
  document.getElementById('cookie-banner').classList.remove('visible');
}

// ── Contact Form ──
async function submitContactForm(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> ...';

  try {
    const data = Object.fromEntries(new FormData(form));
    const resp = await fetch('https://formspree.io/f/xdkgpgvw', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    if (!resp.ok) throw new Error();
    form.innerHTML = '<div class="form-success"><div class="form-success-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></div><h3 style="font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:1.5rem;text-transform:uppercase;margin-bottom:1rem">Nachricht gesendet!</h3><p style="color:var(--zinc-600)">Vielen Dank! Wir melden uns in Kürze bei Ihnen.</p></div>';
  } catch {
    let errDiv = form.querySelector('.form-error');
    if (!errDiv) { errDiv = document.createElement('div'); errDiv.className = 'form-error'; form.appendChild(errDiv); }
    errDiv.textContent = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

async function submitQuoteForm(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type=submit]');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> ...';

  try {
    const data = Object.fromEntries(new FormData(form));
    const resp = await fetch('https://formspree.io/f/xdkgpgvw', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    if (!resp.ok) throw new Error();
    form.innerHTML = '<div class="form-success"><div class="form-success-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></div><h3 style="font-family:Barlow Condensed,sans-serif;font-weight:700;font-size:1.5rem;text-transform:uppercase;margin-bottom:1rem">Anfrage gesendet!</h3><p style="color:var(--zinc-600)">Vielen Dank! Wir senden Ihnen schnellstmöglich ein Angebot.</p></div>';
  } catch {
    let errDiv = form.querySelector('.form-error');
    if (!errDiv) { errDiv = document.createElement('div'); errDiv.className = 'form-error'; form.appendChild(errDiv); }
    errDiv.textContent = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}
