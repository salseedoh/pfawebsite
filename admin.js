const API_URL = new URLSearchParams(window.location.search).get('environment') === 'test'
  ? 'https://prepared-paws-api-test.salcido-heriberto.workers.dev'
  : 'https://prepared-paws-api.salcido-heriberto.workers.dev';
let adminToken = null;
let adminTurnstileSiteKey = null;
let turnstileScript;
let classes = [];
let registrations = [];
let kitOrders = [];
let jaasApiPromise;
let editingClassId = null;
let showClassHistory = false;
let showRegistrationHistory = false;
let showKitOrderHistory = false;

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const money = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const dateTime = (value) => `${new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))} Central Time`;
const formatDuration = (value) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hourText = hours ? `${hours} hour${hours === 1 ? '' : 's'}` : '';
  const minuteText = remainingMinutes ? `${remainingMinutes} minutes` : '';
  return [hourText, minuteText].filter(Boolean).join(' ');
};
const privateClassLink = (course) => `https://preparedpaws.com/?private=${encodeURIComponent(course.private_access_token)}`;
const centralDateTimeInput = (value) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};

function resetClassForm() {
  const form = byId('class-form');
  editingClassId = null;
  form.reset();
  form.title.value = 'Pet First Aid & CPR';
  form.classPrice.value = '125';
  form.classWithKitPrice.value = '150';
  form.maxStudents.value = '10';
  byId('class-form-heading').textContent = 'Add a class';
  byId('class-form-description').textContent = 'Public classes appear on the website. Private classes are accessible only through their shareable registration link.';
  byId('class-form-submit').textContent = 'Publish class';
  byId('cancel-class-edit').classList.add('hidden');
}

function startClassEdit(classId) {
  const course = classes.find((item) => item.id === classId);
  if (!course) return;
  const form = byId('class-form');
  editingClassId = course.id;
  form.title.value = course.title || '';
  form.startsAt.value = centralDateTimeInput(course.starts_at);
  form.durationMinutes.value = course.duration_minutes || '';
  form.location.value = course.location || '';
  form.isVirtual.checked = Boolean(course.is_virtual);
  form.classPrice.value = course.class_price;
  form.classWithKitPrice.value = course.class_with_kit_price;
  form.maxStudents.value = course.max_students;
  form.visibility.checked = course.visibility === 'private';
  byId('class-form-heading').textContent = 'Edit class';
  byId('class-form-description').textContent = 'Update the class details, then save your changes. Existing registrations and payments are not changed.';
  byId('class-form-submit').textContent = 'Save changes';
  byId('cancel-class-edit').classList.remove('hidden');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function loadJaasApi(appId) {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (jaasApiPromise) return jaasApiPromise;
  jaasApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://8x8.vc/${encodeURIComponent(appId)}/external_api.js`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Unable to load the virtual classroom. Please check your connection and try again.'));
    document.head.append(script);
  });
  return jaasApiPromise;
}

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScript) return turnstileScript;
  turnstileScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error('Unable to load the security check. Please refresh and try again.'));
    document.head.append(script);
  });
  return turnstileScript;
}

async function initializeLoginSecurity() {
  const message = byId('login-message');
  try {
    const config = await api('/api/public-config');
    adminTurnstileSiteKey = config.adminTurnstileSiteKey;
    if (!adminTurnstileSiteKey) throw new Error('Admin security check has not been configured.');
    const turnstile = await loadTurnstile();
    turnstile.render('#admin-turnstile', { sitekey: adminTurnstileSiteKey, theme: 'light' });
  } catch (cause) {
    message.textContent = cause.message;
    message.classList.add('form-error');
  }
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401) logout();
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body.error || 'Unable to complete that request.');
  return body;
}

function message(text = '', isError = false) {
  const target = byId('dashboard-message');
  target.textContent = text;
  target.classList.toggle('form-error', isError);
}

function renderClasses() {
  const target = byId('admin-class-list');
  byId('classes-heading').textContent = showClassHistory ? 'Class history' : 'Upcoming classes';
  byId('classes-description').textContent = showClassHistory
    ? 'Archived, cancelled, and past classes are kept here for reference.'
    : 'Set a class to closed when registration should stop, or cancelled if it will not run.';
  byId('toggle-class-history').textContent = showClassHistory ? 'Show upcoming classes' : 'Show class history';
  if (!classes.length) {
    target.innerHTML = `<p class="empty-state">${showClassHistory ? 'No class history yet.' : 'No upcoming classes. Use the form above to publish one.'}</p>`;
    return;
  }
  target.innerHTML = classes.map((course) => {
    const courseRegistrations = registrations.filter((registration) => registration.class_id === course.id);
    const paid = Number(course.paid_registration_count ?? courseRegistrations.filter((registration) => registration.payment_status === 'paid').length);
    const registrationCount = Number(course.registration_count ?? courseRegistrations.length);
    const duration = formatDuration(course.duration_minutes);
    const isPrivate = course.visibility === 'private';
    const isVirtual = Boolean(course.is_virtual);
    return `<article class="admin-class-card">
      <div><p class="date-label">${escapeHtml(dateTime(course.starts_at))}</p><h3>${escapeHtml(course.title)} ${isPrivate ? '<span class="private-badge">Private</span>' : ''} ${isVirtual ? '<span class="virtual-badge">Virtual</span>' : ''}</h3><p>${escapeHtml(course.location)}${duration ? `<br>Expected length: ${escapeHtml(duration)}` : ''}</p><p><strong>${paid} paid</strong> of ${course.max_students} maximum students &middot; ${registrationCount} registrations</p></div>
      <div class="class-admin-actions"><span>${money(course.class_price)} class &middot; ${money(course.class_with_kit_price)} with kit</span><button class="button button-small edit-class" type="button" data-class-id="${course.id}">Edit class</button>${isVirtual && !showClassHistory ? `<button class="button button-small launch-virtual-classroom" type="button" data-class-id="${course.id}">Launch virtual classroom</button>` : ''}${isPrivate ? `<div class="private-class-tools"><button class="button button-small copy-private-link" type="button" data-private-link="${escapeHtml(privateClassLink(course))}">Copy private link</button><button class="text-button regenerate-private-link" type="button" data-class-id="${course.id}">Generate new link</button></div>` : ''}<button class="text-button archive-class" type="button" data-class-id="${course.id}" data-archived="${course.admin_archived_at ? 'true' : 'false'}">${course.admin_archived_at ? 'Restore class' : 'Archive class'}</button><label>Status<select class="class-status" data-class-id="${course.id}"><option value="open" ${course.status === 'open' ? 'selected' : ''}>Open</option><option value="closed" ${course.status === 'closed' ? 'selected' : ''}>Closed</option><option value="cancelled" ${course.status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></label></div>
    </article>`;
  }).join('');
}

function renderRegistrations() {
  const target = byId('registrant-table');
  byId('registrations-heading').textContent = showRegistrationHistory ? 'Registration export history' : 'Student registrations';
  byId('registrations-description').textContent = showRegistrationHistory
    ? 'These records are retained for reference. You can restore a student to the next CSV if necessary.'
    : 'Paid students are included in the ProTrainings CSV once, then moved to export history.';
  byId('toggle-registration-history').textContent = showRegistrationHistory ? 'Show current registrations' : 'Show export history';
  byId('download-csv').classList.toggle('hidden', showRegistrationHistory);
  if (!registrations.length) {
    target.innerHTML = `<tr><td colspan="6" class="empty-cell">${showRegistrationHistory ? 'No exported or archived registrations.' : 'No current registrations need action.'}</td></tr>`;
    return;
  }
  target.innerHTML = registrations.map((registration) => `<tr>
    <td><strong>${escapeHtml(registration.first_name)} ${escapeHtml(registration.last_name)}</strong><br><span class="muted">${escapeHtml(registration.email)}</span></td>
    <td>${escapeHtml(registration.class_title)}<br><span class="muted">${escapeHtml(dateTime(registration.class_starts_at))}</span></td>
    <td>${escapeHtml(registration.language)}</td>
    <td>${registration.kit_selected ? 'Class + kit' : 'Class only'}<br><strong>${money(registration.amount_cents / 100)}</strong></td>
    <td><select class="payment-status" data-registration-id="${registration.id}"><option value="awaiting_payment" ${registration.payment_status === 'awaiting_payment' ? 'selected' : ''}>Awaiting payment</option><option value="paid" ${registration.payment_status === 'paid' ? 'selected' : ''}>Paid</option><option value="refunded" ${registration.payment_status === 'refunded' ? 'selected' : ''}>Refunded</option><option value="cancelled" ${registration.payment_status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></td>
    <td><div class="record-actions">${registration.protrainings_exported_at ? '<span class="muted">Exported to ProTrainings</span><button class="text-button restore-registration-export" type="button" data-registration-id="' + registration.id + '">Include in next CSV</button>' : (registration.payment_status === 'paid' ? '<button class="text-button mark-registration-exported" type="button" data-registration-id="' + registration.id + '">Mark as already exported</button>' : '')}<button class="text-button archive-registration" type="button" data-registration-id="${registration.id}" data-archived="${registration.admin_archived_at ? 'true' : 'false'}">${registration.admin_archived_at ? 'Restore registration' : 'Archive'}</button></div></td>
  </tr>`).join('');
}

function renderKitOrders() {
  const target = byId('kit-order-table');
  byId('kit-orders-heading').textContent = showKitOrderHistory ? 'First aid kit order history' : 'First aid kit orders';
  byId('kit-orders-description').textContent = showKitOrderHistory
    ? 'Archived orders remain available here for reference.'
    : 'Kit-only purchases are kept separate from course registrations and are not included in the ProTrainings CSV.';
  byId('toggle-kit-order-history').textContent = showKitOrderHistory ? 'Show current orders' : 'Show order history';
  if (!kitOrders.length) {
    target.innerHTML = `<tr><td colspan="5" class="empty-cell">${showKitOrderHistory ? 'No archived kit orders.' : 'No current kit-only orders.'}</td></tr>`;
    return;
  }
  target.innerHTML = kitOrders.map((order) => `<tr>
    <td><strong>${escapeHtml(order.first_name)} ${escapeHtml(order.last_name)}</strong><br><span class="muted">${escapeHtml(order.email)}</span></td>
    <td>${escapeHtml(dateTime(order.created_at + 'Z'))}</td>
    <td><strong>${money(order.amount_cents / 100)}</strong></td>
    <td><select class="kit-payment-status" data-order-id="${order.id}"><option value="awaiting_payment" ${order.payment_status === 'awaiting_payment' ? 'selected' : ''}>Awaiting payment</option><option value="paid" ${order.payment_status === 'paid' ? 'selected' : ''}>Paid</option><option value="refunded" ${order.payment_status === 'refunded' ? 'selected' : ''}>Refunded</option><option value="cancelled" ${order.payment_status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></td>
    <td><button class="text-button archive-kit-order" type="button" data-order-id="${order.id}" data-archived="${order.admin_archived_at ? 'true' : 'false'}">${order.admin_archived_at ? 'Restore order' : 'Archive order'}</button></td>
  </tr>`).join('');
}

async function loadDashboard() {
  try {
    [classes, registrations, kitOrders] = await Promise.all([
      api(`/api/admin/classes${showClassHistory ? '?history=1' : ''}`),
      api(`/api/admin/registrations${showRegistrationHistory ? '?history=1' : ''}`),
      api(`/api/admin/kit-orders${showKitOrderHistory ? '?history=1' : ''}`),
    ]);
    renderClasses();
    renderRegistrations();
    renderKitOrders();
  } catch (cause) {
    message(cause.message, true);
  }
}

function showDashboard() {
  byId('admin-login').classList.add('hidden');
  byId('dashboard').classList.remove('hidden');
  loadDashboard();
}

function logout() {
  adminToken = null;
  byId('dashboard').classList.add('hidden');
  byId('admin-login').classList.remove('hidden');
  byId('admin-password').value = '';
}

byId('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const loginMessage = byId('login-message');
  loginMessage.textContent = 'Opening dashboard...';
  try {
    const turnstileToken = document.querySelector('[name="cf-turnstile-response"]')?.value || '';
    if (!adminTurnstileSiteKey || !turnstileToken) throw new Error('Please complete the security check before continuing.');
    const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: form.get('email'), password: form.get('password'), turnstileToken }) });
    adminToken = result.token;
    loginMessage.textContent = '';
    showDashboard();
  } catch (cause) {
    loginMessage.textContent = cause.message;
    loginMessage.classList.add('form-error');
  }
});

byId('class-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const editing = Boolean(editingClassId);
  const payload = { ...values, isVirtual: form.isVirtual.checked, visibility: form.visibility.checked ? 'private' : 'public', startsAt: new Date(values.startsAt).toISOString() };
  try {
    message(editing ? 'Saving class changes...' : 'Publishing class...');
    const result = await api(editing ? `/api/admin/classes/${encodeURIComponent(editingClassId)}` : '/api/admin/classes', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
    resetClassForm();
    message(editing ? 'Class details updated.' : (result.privateAccessToken ? 'Private class created. Copy its private registration link below.' : 'Class published. It is now visible on the website.'));
    await loadDashboard();
  } catch (cause) { message(cause.message, true); }
});

byId('cancel-class-edit').addEventListener('click', resetClassForm);

byId('toggle-class-history').addEventListener('click', async () => {
  showClassHistory = !showClassHistory;
  await loadDashboard();
});

byId('toggle-registration-history').addEventListener('click', async () => {
  showRegistrationHistory = !showRegistrationHistory;
  await loadDashboard();
});

byId('toggle-kit-order-history').addEventListener('click', async () => {
  showKitOrderHistory = !showKitOrderHistory;
  await loadDashboard();
});

byId('admin-class-list').addEventListener('change', async (event) => {
  const select = event.target.closest('.class-status');
  if (!select) return;
  try {
    await api(`/api/admin/classes/${select.dataset.classId}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
    message('Class status updated.');
    await loadDashboard();
  } catch (cause) { message(cause.message, true); }
});

byId('admin-class-list').addEventListener('click', async (event) => {
  const editButton = event.target.closest('.edit-class');
  if (editButton) {
    startClassEdit(editButton.dataset.classId);
    return;
  }
  const launchButton = event.target.closest('.launch-virtual-classroom');
  if (launchButton) {
    const classroom = byId('virtual-classroom');
    const frame = byId('virtual-classroom-frame');
    const classroomTitle = byId('virtual-classroom-title');
    const classroomMessage = byId('virtual-classroom-message');
    classroom.classList.remove('hidden');
    classroomMessage.classList.remove('form-error');
    frame.replaceChildren();
    classroomTitle.textContent = 'Virtual classroom';
    classroomMessage.textContent = 'Preparing your secure instructor access…';
    classroom.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const access = await api(`/api/admin/classes/${encodeURIComponent(launchButton.dataset.classId)}/virtual-host-access`, { method: 'POST' });
      await loadJaasApi(access.appId);
      classroomTitle.textContent = access.title;
      classroomMessage.textContent = 'You are joining as the class instructor.';
      new window.JitsiMeetExternalAPI('8x8.vc', { roomName: `${access.appId}/${access.roomName}`, jwt: access.jwt, parentNode: frame, width: '100%', height: 720 });
    } catch (cause) {
      classroomMessage.textContent = cause.message;
      classroomMessage.classList.add('form-error');
    }
    return;
  }
  const copyButton = event.target.closest('.copy-private-link');
  if (copyButton) {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.privateLink);
      message('Private registration link copied.');
    } catch {
      message('Unable to copy the link. Please try again.', true);
    }
    return;
  }
  const archiveButton = event.target.closest('.archive-class');
  if (archiveButton) {
    const archived = archiveButton.dataset.archived === 'true';
    if (!archived && !window.confirm('Archive this class? It will be removed from the upcoming list but its records will be kept.')) return;
    try {
      await api(`/api/admin/classes/${archiveButton.dataset.classId}`, { method: 'PATCH', body: JSON.stringify({ archived: !archived }) });
      message(archived ? 'Class restored to the upcoming list.' : 'Class archived. Its records were kept.');
      await loadDashboard();
    } catch (cause) { message(cause.message, true); }
    return;
  }
  const regenerateButton = event.target.closest('.regenerate-private-link');
  if (!regenerateButton) return;
  if (!window.confirm('Generate a new private link? Anyone using the current link will no longer be able to register.')) return;
  try {
    await api(`/api/admin/classes/${regenerateButton.dataset.classId}`, { method: 'PATCH', body: JSON.stringify({ regeneratePrivateLink: true }) });
    message('A new private registration link has been created.');
    await loadDashboard();
  } catch (cause) { message(cause.message, true); }
});

byId('close-virtual-classroom').addEventListener('click', () => {
  byId('virtual-classroom-frame').replaceChildren();
  byId('virtual-classroom').classList.add('hidden');
});

byId('registrant-table').addEventListener('change', async (event) => {
  const select = event.target.closest('.payment-status');
  if (!select) return;
  try {
    await api(`/api/admin/registrations/${select.dataset.registrationId}`, { method: 'PATCH', body: JSON.stringify({ paymentStatus: select.value }) });
    message('Payment status updated.');
    await loadDashboard();
  } catch (cause) { message(cause.message, true); }
});

byId('registrant-table').addEventListener('click', async (event) => {
  const archiveButton = event.target.closest('.archive-registration');
  const restoreExportButton = event.target.closest('.restore-registration-export');
  const markExportedButton = event.target.closest('.mark-registration-exported');
  if (!archiveButton && !restoreExportButton && !markExportedButton) return;
  const registrationId = (archiveButton || restoreExportButton || markExportedButton).dataset.registrationId;
  const archived = archiveButton?.dataset.archived === 'true';
  if (archiveButton && !archived && !window.confirm('Archive this registration? It will be removed from the current dashboard but kept safely in history.')) return;
  if (markExportedButton && !window.confirm('Mark this student as already exported to ProTrainings? They will not appear in the next CSV.')) return;
  try {
    await api(`/api/admin/registrations/${registrationId}`, {
      method: 'PATCH',
      body: JSON.stringify(archiveButton ? { archived: !archived } : (restoreExportButton ? { restoreProtrainingsExport: true } : { markProtrainingsExported: true })),
    });
    message(restoreExportButton ? 'Registration will be included in the next ProTrainings CSV.' : (markExportedButton ? 'Registration marked as exported to ProTrainings.' : (archived ? 'Registration restored.' : 'Registration archived.')));
    await loadDashboard();
  } catch (cause) { message(cause.message, true); }
});

byId('kit-order-table').addEventListener('change', async (event) => {
  const select = event.target.closest('.kit-payment-status');
  if (!select) return;
  try {
    await api(`/api/admin/kit-orders/${select.dataset.orderId}`, { method: 'PATCH', body: JSON.stringify({ paymentStatus: select.value }) });
    message('Kit order payment status updated.');
    await loadDashboard();
  } catch (cause) { message(cause.message, true); }
});

byId('kit-order-table').addEventListener('click', async (event) => {
  const archiveButton = event.target.closest('.archive-kit-order');
  if (!archiveButton) return;
  const archived = archiveButton.dataset.archived === 'true';
  if (!archived && !window.confirm('Archive this kit order? It will be removed from the current dashboard but kept safely in history.')) return;
  try {
    await api(`/api/admin/kit-orders/${archiveButton.dataset.orderId}`, { method: 'PATCH', body: JSON.stringify({ archived: !archived }) });
    message(archived ? 'Kit order restored.' : 'Kit order archived.');
    await loadDashboard();
  } catch (cause) { message(cause.message, true); }
});

byId('download-csv').addEventListener('click', async () => {
  try {
    const response = await fetch(`${API_URL}/api/admin/export.csv`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Unable to create the CSV.');
    }
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'protrainings-registrations.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    message('CSV downloaded. Included students were moved to export history.');
    await loadDashboard();
  } catch (cause) { message(cause.message, true); }
});

byId('log-out').addEventListener('click', logout);
initializeLoginSecurity();
