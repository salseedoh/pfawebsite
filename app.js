const API_URL = 'https://prepared-paws-api.salcido-heriberto.workers.dev';
let availableClasses = [];
let activeClass = null;

const classList = document.getElementById('class-list');
const modal = document.getElementById('registration');
const content = document.getElementById('registration-content');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const dateOnly = (value) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(value));
const timeOnly = (value) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
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
    classList.innerHTML = '<p class="empty-state">New class dates will be announced soon. Please check back next week.</p>';
    return;
  }
  classList.innerHTML = availableClasses.map((course) => {
    const duration = formatDuration(course.duration_minutes);
    return `<article class="class-card">
    <p class="date-label">${escapeHtml(dateOnly(course.starts_at))}</p>
    <h3>${escapeHtml(course.title)}</h3>
    <p class="class-meta">${escapeHtml(timeOnly(course.starts_at))}<br>${escapeHtml(course.location)}${duration ? `<br>Expected length: ${escapeHtml(duration)}` : ''}<br>Limited to ${course.max_students} students</p>
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
    classList.innerHTML = '<p class="empty-state">New class dates will be announced soon. Please check back next week.</p>';
  }
}

function closeRegistration() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function openModal() {
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function showPaymentNextStep(result, firstName, itemName) {
  const link = result.paymentLink;
  content.innerHTML = `<div class="confirmation"><div class="success">✓</div><p class="eyebrow">Registration received</p><h2>One more step, ${escapeHtml(firstName)}.</h2><p>Your ${itemName} is reserved while payment is completed. ${link ? 'Continue to Chase to pay securely.' : 'Online payment is being connected. Your reservation is awaiting payment and is not confirmed yet.'}</p>${link ? '<a class="button" id="payment-link" href="' + escapeHtml(link) + '">Continue to secure payment</a>' : ''}<button class="text-button modal-done" type="button">Done</button></div>`;
}

function showClassForm() {
  const duration = formatDuration(activeClass.duration_minutes);
  content.innerHTML = `<p class="eyebrow">Reserve your place</p><h2 id="registration-title">${escapeHtml(activeClass.title)}</h2><p>${escapeHtml(dateOnly(activeClass.starts_at))} &middot; ${escapeHtml(timeOnly(activeClass.starts_at))}<br>${escapeHtml(activeClass.location)}${duration ? `<br>Expected length: ${escapeHtml(duration)}` : ''}</p>
    <form id="registration-form"><div class="form-grid"><label>Email*<input name="email" type="email" autocomplete="email" required></label><label>First name*<input name="firstName" autocomplete="given-name" required></label><label>Last name*<input name="lastName" autocomplete="family-name" required></label><label>Language<select name="language"><option value="english">English</option><option value="spanish">Spanish</option><option value="french">French</option><option value="other">Other</option></select></label></div>
    <fieldset><legend>Would you like to add a pet first aid kit?</legend><label class="radio-option"><input type="radio" name="kit" value="no" checked><span><strong>Class only</strong>Course registration &middot; ${money(activeClass.class_price)}</span></label><label class="radio-option"><input type="radio" name="kit" value="yes"><span><strong>Class + first aid kit</strong>Course and kit &middot; ${money(activeClass.class_with_kit_price)}</span></label></fieldset><button class="button" type="submit">Continue to payment</button><p class="form-note" id="registration-note">Your class information is saved before you are sent to secure payment.</p></form>`;
  document.getElementById('registration-form').addEventListener('submit', submitRegistration);
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
    const result = await publicApi('/api/registrations', { method: 'POST', body: JSON.stringify({ classId: activeClass.id, email: values.email, firstName: values.firstName, lastName: values.lastName, language: values.language, kitSelected: values.kit === 'yes' }) });
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
  content.innerHTML = `<p class="eyebrow">Pet first aid kit</p><h2>Be ready at home and on the go.</h2><p>Order the Adventure First Aid Kit on its own for <strong>$40</strong>.</p><form id="kit-only-form"><div class="form-grid"><label class="full">Email*<input name="email" type="email" autocomplete="email" required></label><label>First name*<input name="firstName" autocomplete="given-name" required></label><label>Last name*<input name="lastName" autocomplete="family-name" required></label></div><button class="button" type="submit">Continue to payment &middot; $40</button><p class="form-note" id="kit-note">Your order is saved before you are sent to secure payment.</p></form>`;
  document.getElementById('kit-only-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const button = form.querySelector('button');
    const note = document.getElementById('kit-note');
    button.disabled = true;
    button.textContent = 'Saving order...';
    try {
      const result = await publicApi('/api/kit-orders', { method: 'POST', body: JSON.stringify(values) });
      showPaymentNextStep(result, values.firstName, 'first aid kit');
    } catch (cause) {
      button.disabled = false;
      button.textContent = 'Continue to payment · $40';
      note.textContent = cause.message;
      note.classList.add('form-error');
    }
  });
}

document.addEventListener('click', (event) => {
  const registerButton = event.target.closest('.register-button');
  if (registerButton) {
    activeClass = availableClasses.find((course) => course.id === registerButton.dataset.class);
    if (activeClass) { openModal(); showClassForm(); }
  }
  if (event.target.closest('[data-close], .modal-done')) closeRegistration();
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeRegistration(); });

document.getElementById('year').textContent = new Date().getFullYear();
const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.site-nav');
menuButton.addEventListener('click', () => { const open = nav.classList.toggle('open'); menuButton.setAttribute('aria-expanded', open); });
loadClasses();
