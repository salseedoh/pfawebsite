const API_URL = 'https://prepared-paws-api.salcido-heriberto.workers.dev';
const tokenKey = 'preparedPawsAdminToken';
let adminToken = sessionStorage.getItem(tokenKey);
let classes = [];
let registrations = [];
let kitOrders = [];

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const money = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const dateTime = (value) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

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
  if (!classes.length) {
    target.innerHTML = '<p class="empty-state">No classes yet. Use the form above to publish your first one.</p>';
    return;
  }
  target.innerHTML = classes.map((course) => {
    const courseRegistrations = registrations.filter((registration) => registration.class_id === course.id);
    const paid = courseRegistrations.filter((registration) => registration.payment_status === 'paid').length;
    return `<article class="admin-class-card">
      <div><p class="date-label">${escapeHtml(dateTime(course.starts_at))}</p><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.location)}</p><p><strong>${paid} paid</strong> of ${course.max_students} maximum students &middot; ${courseRegistrations.length} registrations</p></div>
      <div class="class-admin-actions"><span>${money(course.class_price)} class &middot; ${money(course.class_with_kit_price)} with kit</span><label>Status<select class="class-status" data-class-id="${course.id}"><option value="open" ${course.status === 'open' ? 'selected' : ''}>Open</option><option value="closed" ${course.status === 'closed' ? 'selected' : ''}>Closed</option><option value="cancelled" ${course.status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></label></div>
    </article>`;
  }).join('');
}

function renderRegistrations() {
  const target = byId('registrant-table');
  if (!registrations.length) {
    target.innerHTML = '<tr><td colspan="5" class="empty-cell">No registrations yet.</td></tr>';
    return;
  }
  target.innerHTML = registrations.map((registration) => `<tr>
    <td><strong>${escapeHtml(registration.first_name)} ${escapeHtml(registration.last_name)}</strong><br><span class="muted">${escapeHtml(registration.email)}</span></td>
    <td>${escapeHtml(registration.class_title)}<br><span class="muted">${escapeHtml(dateTime(registration.class_starts_at))}</span></td>
    <td>${escapeHtml(registration.language)}</td>
    <td>${registration.kit_selected ? 'Class + kit' : 'Class only'}<br><strong>${money(registration.amount_cents / 100)}</strong></td>
    <td><select class="payment-status" data-registration-id="${registration.id}"><option value="awaiting_payment" ${registration.payment_status === 'awaiting_payment' ? 'selected' : ''}>Awaiting payment</option><option value="paid" ${registration.payment_status === 'paid' ? 'selected' : ''}>Paid</option><option value="refunded" ${registration.payment_status === 'refunded' ? 'selected' : ''}>Refunded</option><option value="cancelled" ${registration.payment_status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></td>
  </tr>`).join('');
}

function renderKitOrders() {
  const target = byId('kit-order-table');
  if (!kitOrders.length) {
    target.innerHTML = '<tr><td colspan="4" class="empty-cell">No kit-only orders yet.</td></tr>';
    return;
  }
  target.innerHTML = kitOrders.map((order) => `<tr>
    <td><strong>${escapeHtml(order.first_name)} ${escapeHtml(order.last_name)}</strong><br><span class="muted">${escapeHtml(order.email)}</span></td>
    <td>${escapeHtml(dateTime(order.created_at + 'Z'))}</td>
    <td><strong>${money(order.amount_cents / 100)}</strong></td>
    <td><select class="kit-payment-status" data-order-id="${order.id}"><option value="awaiting_payment" ${order.payment_status === 'awaiting_payment' ? 'selected' : ''}>Awaiting payment</option><option value="paid" ${order.payment_status === 'paid' ? 'selected' : ''}>Paid</option><option value="refunded" ${order.payment_status === 'refunded' ? 'selected' : ''}>Refunded</option><option value="cancelled" ${order.payment_status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></td>
  </tr>`).join('');
}

async function loadDashboard() {
  try {
    [classes, registrations, kitOrders] = await Promise.all([api('/api/admin/classes'), api('/api/admin/registrations'), api('/api/admin/kit-orders')]);
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
  sessionStorage.removeItem(tokenKey);
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
    const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
    adminToken = result.token;
    sessionStorage.setItem(tokenKey, adminToken);
    loginMessage.textContent = '';
    showDashboard();
  } catch (cause) {
    loginMessage.textContent = cause.message;
    loginMessage.classList.add('form-error');
  }
});

byId('class-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    message('Publishing class...');
    await api('/api/admin/classes', { method: 'POST', body: JSON.stringify({ ...values, startsAt: new Date(values.startsAt).toISOString() }) });
    event.currentTarget.reset();
    event.currentTarget.classPrice.value = '125';
    event.currentTarget.classWithKitPrice.value = '150';
    event.currentTarget.maxStudents.value = '10';
    message('Class published. It is now visible on the website.');
    await loadDashboard();
  } catch (cause) { message(cause.message, true); }
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

byId('registrant-table').addEventListener('change', async (event) => {
  const select = event.target.closest('.payment-status');
  if (!select) return;
  try {
    await api(`/api/admin/registrations/${select.dataset.registrationId}`, { method: 'PATCH', body: JSON.stringify({ paymentStatus: select.value }) });
    message('Payment status updated.');
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

byId('download-csv').addEventListener('click', async () => {
  try {
    const response = await fetch(`${API_URL}/api/admin/export.csv`, { headers: { Authorization: `Bearer ${adminToken}` } });
    if (!response.ok) throw new Error('Unable to create the CSV.');
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'protrainings-registrations.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (cause) { message(cause.message, true); }
});

byId('log-out').addEventListener('click', logout);
if (adminToken) showDashboard();
