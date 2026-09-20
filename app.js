const API_URL = 'https://prepared-paws-api.salcido-heriberto.workers.dev';
let availableClasses = [];
let activeClass = null;
let activePrivateAccessToken = null;
let lastFocusedElement = null;
let publicConfig = { turnstileSiteKey: null };
let turnstileScript;
const SITE_TIME_ZONE = 'America/Chicago';

const classList = document.getElementById('class-list');
const modal = document.getElementById('registration');
const content = document.getElementById('registration-content');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const dateOnly = (value) => new Intl.DateTimeFormat('en-US', { timeZone: SITE_TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value));
const timeOnly = (value) => new Intl.DateTimeFormat('en-US', { timeZone: SITE_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const classTime = (value) => `${timeOnly(value)} Central Time`;
const money = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
const formatDuration = (value) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hourText = hours ? `${hours} hour${hours === 1 ? '' : 's'}` : '';
  const minuteText = remainingMinutes ? `${remainingMinutes} minutes` : '';
  return [hourText, minuteText].filter(Boolean).join(' ');
};

async function publicApi(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unable to complete that request.');
  return body;
}

function renderClasses() {
  if (!availableClasses.length) {
    classList.innerHTML = '<p class="empty-state">New class dates will be announced soon. Please check back later this week.</p>';
    return;
  }
  classList.innerHTML = availableClasses.map((course) => {
    const duration = formatDuration(course.duration_minutes);
    return `<article class="class-card">
    <p class="date-label">${escapeHtml(dateOnly(course.starts_at))}</p>
    <h3>${escapeHtml(course.title)}</h3>
    <p class="class-meta">${escapeHtml(classTime(course.starts_at))}<br>${escapeHtml(course.location)}${duration ? `<br>Expected length: ${escapeHtml(duration)}` : ''}<br>Limited to ${course.max_students} students</p>
    <p><strong>${money(course.class_price)}</strong> per student</p>
    <button class="button register-button" data-class="${course.id}">Select this class</button>
  </article>`;
  }).join('');
}

async function loadClasses() {
  classList.innerHTML = '<p class="empty-state">Loading upcoming classes...</p>';
  try {
    availableClasses = await publicApi('/api/classes');
    renderClasses();
  } catch (cause) {
    classList.innerHTML = '<p class="empty-state">We are having trouble loading class dates right now. Please try again shortly, or <a href="mailto:contact@preparedpaws.com">email us</a> for help.</p>';
  }
}

function closeRegistration() {
  if (!modal.classList.contains('open')) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
  lastFocusedElement = null;
}

function openModal() {
  lastFocusedElement = document.activeElement;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => modal.querySelector('.close-button')?.focus());
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScript) return turnstileScript;
  turnstileScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error('Unable to load the security check. Please try again.'));
    document.head.append(script);
  });
  return turnstileScript;
}

async function renderTurnstile(form) {
  const container = form.querySelector('.turnstile-widget');
  if (!container || !publicConfig.turnstileSiteKey) return;
  try {
    const turnstile = await loadTurnstile();
    turnstile.render(container, { sitekey: publicConfig.turnstileSiteKey, theme: 'light' });
  } catch (cause) {
    const note = form.querySelector('.form-note');
    note.textContent = cause.message;
    note.classList.add('form-error');
  }
}

function turnstileToken(form) {
  return form.querySelector('[name="cf-turnstile-response"]')?.value || '';
}

function showPaymentNextStep(result, firstName, itemName) {
  const link = result.paymentLink;
  content.innerHTML = `<div class="confirmation"><div class="success">✓</div><p class="eyebrow">Registration received</p><h2>One more step, ${escapeHtml(firstName)}.</h2><p>Your ${itemName} is reserved while payment is completed. ${link ? 'Continue to Chase to pay securely.' : 'Online payment is being connected. Your reservation is awaiting payment and is not confirmed yet.'}</p>${link ? '<a class="button" id="payment-link" href="' + escapeHtml(link) + '">Continue to secure payment</a>' : ''}<button class="text-button modal-done" type="button">Done</button></div>`;
}

function showClassForm() {
  const duration = formatDuration(activeClass.duration_minutes);
  content.innerHTML = `<p class="eyebrow">${activePrivateAccessToken ? 'Private class registration' : 'Reserve your place'}</p><h2 id="registration-title">${escapeHtml(activeClass.title)}</h2><p>${escapeHtml(dateOnly(activeClass.starts_at))} &middot; ${escapeHtml(classTime(activeClass.starts_at))}<br>${escapeHtml(activeClass.location)}${duration ? `<br>Expected length: ${escapeHtml(duration)}` : ''}</p>
    <form id="registration-form"><div class="form-grid"><label>Email*<input name="email" type="email" autocomplete="email" required></label><label>First name*<input name="firstName" autocomplete="given-name" required></label><label>Last name*<input name="lastName" autocomplete="family-name" required></label><label>Language<select name="language"><option value="english">English</option><option value="spanish">Spanish</option><option value="french">French</option><option value="other">Other</option></select></label></div>
    <fieldset><legend>Would you like to add a pet first aid kit?</legend><label class="radio-option"><input type="radio" name="kit" value="no" checked><span><strong>Class only</strong>Course registration &middot; ${money(activeClass.class_price)}</span></label><label class="radio-option"><input type="radio" name="kit" value="yes"><span><strong>Class + first aid kit</strong>Course and kit &middot; ${money(activeClass.class_with_kit_price)}</span></label></fieldset><div class="turnstile-widget"></div><button class="button" type="submit">Continue to payment</button><p class="form-note" id="registration-note" role="status">Your class information is saved before you are sent to secure payment.</p></form>`;
  const form = document.getElementById('registration-form');
  form.addEventListener('submit', submitRegistration);
  renderTurnstile(form);
}

async function submitRegistration(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const button = form.querySelector('button');
  const note = document.getElementById('registration-note');
  button.disabled = true;
  button.textContent = 'Saving registration...';
  try {
    if (publicConfig.turnstileSiteKey && !turnstileToken(form)) throw new Error('Please complete the security check before continuing.');
    const result = await publicApi('/api/registrations', { method: 'POST', body: JSON.stringify({ classId: activeClass.id, email: values.email, firstName: values.firstName, lastName: values.lastName, language: values.language, kitSelected: values.kit === 'yes', privateAccessToken: activePrivateAccessToken, turnstileToken: turnstileToken(form) }) });
    showPaymentNextStep(result, values.firstName, values.kit === 'yes' ? 'class and first aid kit' : 'class');
  } catch (cause) {
    button.disabled = false;
    button.textContent = 'Continue to payment';
    note.textContent = cause.message;
    note.classList.add('form-error');
  }
}

function showKitOnlyForm() {
  openModal();
  content.innerHTML = `<p class="eyebrow">Pet first aid kit</p><h2>Be ready at home and on the go.</h2><p>Order the Adventure First Aid Kit on its own for <strong>$40</strong>.</p><form id="kit-only-form"><div class="form-grid"><label class="full">Email*<input name="email" type="email" autocomplete="email" required></label><label>First name*<input name="firstName" autocomplete="given-name" required></label><label>Last name*<input name="lastName" autocomplete="family-name" required></label></div><div class="turnstile-widget"></div><button class="button" type="submit">Continue to payment &middot; $40</button><p class="form-note" id="kit-note" role="status">Your order is saved before you are sent to secure payment.</p></form>`;
  const kitForm = document.getElementById('kit-only-form');
  kitForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const button = form.querySelector('button');
    const note = document.getElementById('kit-note');
    button.disabled = true;
    button.textContent = 'Saving order...';
    try {
      if (publicConfig.turnstileSiteKey && !turnstileToken(form)) throw new Error('Please complete the security check before continuing.');
      const result = await publicApi('/api/kit-orders', { method: 'POST', body: JSON.stringify({ ...values, turnstileToken: turnstileToken(form) }) });
      showPaymentNextStep(result, values.firstName, 'first aid kit');
    } catch (cause) {
      button.disabled = false;
      button.textContent = 'Continue to payment · $40';
      note.textContent = cause.message;
      note.classList.add('form-error');
    }
  });
  renderTurnstile(kitForm);
}

document.addEventListener('click', (event) => {
  const registerButton = event.target.closest('.register-button');
  if (registerButton) {
    activeClass = availableClasses.find((course) => course.id === registerButton.dataset.class);
    activePrivateAccessToken = null;
    if (activeClass) { openModal(); showClassForm(); }
  }
  if (event.target.closest('[data-close], .modal-done')) closeRegistration();
});
document.addEventListener('keydown', (event) => {
  if (!modal.classList.contains('open')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeRegistration();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

document.getElementById('year').textContent = new Date().getFullYear();
const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.site-nav');
menuButton.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', open);
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
nav.addEventListener('click', (event) => {
  if (!event.target.closest('a')) return;
  nav.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open menu');
});

async function initialize() {
  try { publicConfig = await publicApi('/api/public-config'); } catch { /* Registration remains usable until Turnstile is configured. */ }
  const privateAccessToken = new URLSearchParams(window.location.search).get('private');
  if (privateAccessToken) {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.append(robots);
    openModal();
    content.innerHTML = '<p class="eyebrow">Private class registration</p><h2 id="registration-title">Loading your class...</h2>';
    try {
      activeClass = await publicApi(`/api/private-classes/${encodeURIComponent(privateAccessToken)}`);
      activePrivateAccessToken = privateAccessToken;
      showClassForm();
    } catch (cause) {
      content.innerHTML = `<div class="confirmation"><p class="eyebrow">Private class</p><h2 id="registration-title">This link is unavailable.</h2><p>${escapeHtml(cause.message || 'Please contact us for help with your registration.')}</p><a class="button" href="mailto:contact@preparedpaws.com">Email us</a><button class="text-button modal-done" type="button">Done</button></div>`;
    }
  }
  loadClasses();
}

initialize();
