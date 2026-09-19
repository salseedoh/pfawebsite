const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
// Only the live Prepared Paws domain may make browser requests to this API.
const APP_ORIGINS = [
  'https://preparedpaws.com',
  'https://www.preparedpaws.com',
];

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
const error = (message, status = 400) => json({ error: message }, status);
const clean = (value) => String(value ?? '').trim();
const id = () => crypto.randomUUID();
const privateAccessToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};
const asBoolean = (value) => value === true || value === 1 || value === '1';
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

function cors(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = new Set([...APP_ORIGINS, ...(env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter((item) => item && item !== 'https://salseedoh.github.io')]);
  return origin && allowed.has(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {};
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function authenticate(request, env) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !env.SESSION_SECRET) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || signature !== await sign(payload, env.SESSION_SECRET)) return false;
  try { return JSON.parse(atob(payload)).exp > Date.now(); } catch { return false; }
}

function mapClass(row) {
  return { ...row, class_price: row.class_price_cents / 100, class_with_kit_price: row.class_with_kit_price_cents / 100 };
}

function publicClass(row) {
  const course = mapClass(row);
  delete course.private_access_token;
  return course;
}

async function listClasses(env, includeAll = false) {
  const query = includeAll
    ? 'SELECT * FROM classes ORDER BY starts_at ASC'
    : "SELECT * FROM classes WHERE status = 'open' AND visibility = 'public' AND starts_at >= datetime('now', '-1 day') ORDER BY starts_at ASC";
  const { results } = await env.DB.prepare(query).all();
  return results.map(includeAll ? mapClass : publicClass);
}

async function privateClass(env, accessToken) {
  const course = await env.DB.prepare("SELECT * FROM classes WHERE visibility = 'private' AND private_access_token = ? AND status = 'open' AND starts_at >= datetime('now', '-1 day')")
    .bind(accessToken).first();
  return course ? publicClass(course) : null;
}

async function verifyTurnstile(token, request, env) {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  const remoteIp = request.headers.get('CF-Connecting-IP');
  if (remoteIp) form.append('remoteip', remoteIp);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const result = await response.json();
  return result.success === true;
}

async function createRegistration(request, env) {
  const body = await request.json();
  const classId = clean(body.classId);
  const email = clean(body.email).toLowerCase();
  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  const language = clean(body.language || 'english').toLowerCase();
  const kitSelected = asBoolean(body.kitSelected);
  const accessToken = clean(body.privateAccessToken);
  if (!classId || !/^\S+@\S+\.\S+$/.test(email) || !firstName || !lastName) return error('Please provide an email, first name, and last name.');
  if (!await verifyTurnstile(clean(body.turnstileToken), request, env)) return error('Please complete the security check and try again.', 403);
  const course = await env.DB.prepare("SELECT * FROM classes WHERE id = ? AND status = 'open'").bind(classId).first();
  if (!course) return error('This class is no longer open for registration.', 404);
  if (course.visibility === 'private' && (!accessToken || accessToken !== course.private_access_token)) return error('This private class link is no longer active.', 404);
  const existing = await env.DB.prepare("SELECT id FROM registrations WHERE class_id = ? AND email = ? AND payment_status IN ('awaiting_payment', 'paid') LIMIT 1").bind(classId, email).first();
  if (existing) return error('This email is already registered for this class. Each student must register with their own email address.', 409);
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM registrations WHERE class_id = ? AND payment_status IN ('awaiting_payment', 'paid')").bind(classId).first();
  if (count.count >= course.max_students) return error('This class is now full. Please choose another date.', 409);
  const amount = kitSelected ? course.class_with_kit_price_cents : course.class_price_cents;
  const registration = { id: id(), classId, email, firstName, lastName, language, kitSelected, amount };
  await env.DB.prepare('INSERT INTO registrations (id, class_id, email, first_name, last_name, language, kit_selected, amount_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(registration.id, classId, email, firstName, lastName, language, kitSelected ? 1 : 0, amount).run();
  const link = kitSelected ? env.CHASE_CLASS_KIT_LINK : env.CHASE_CLASS_LINK;
  return json({ registrationId: registration.id, paymentStatus: 'awaiting_payment', amount: amount / 100, paymentLink: link || null }, 201);
}

async function createKitOrder(request, env) {
  const body = await request.json();
  const email = clean(body.email).toLowerCase();
  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  if (!/^\S+@\S+\.\S+$/.test(email) || !firstName || !lastName) return error('Please provide an email, first name, and last name.');
  if (!await verifyTurnstile(clean(body.turnstileToken), request, env)) return error('Please complete the security check and try again.', 403);
  const order = { id: id(), email, firstName, lastName };
  await env.DB.prepare('INSERT INTO kit_orders (id, email, first_name, last_name) VALUES (?, ?, ?, ?)').bind(order.id, email, firstName, lastName).run();
  return json({ orderId: order.id, paymentStatus: 'awaiting_payment', amount: 40, paymentLink: env.CHASE_KIT_LINK || null }, 201);
}

async function adminLogin(request, env) {
  const { email, password } = await request.json();
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.SESSION_SECRET) return error('Admin access has not been configured.', 503);
  if (clean(email).toLowerCase() !== env.ADMIN_EMAIL.toLowerCase() || password !== env.ADMIN_PASSWORD) return error('Incorrect email or password.', 401);
  const payload = btoa(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 }));
  return json({ token: `${payload}.${await sign(payload, env.SESSION_SECRET)}` });
}

async function createClass(request, env) {
  const body = await request.json();
  const visibility = clean(body.visibility || 'public');
  const course = { id: id(), title: clean(body.title), startsAt: clean(body.startsAt), durationMinutes: Number(body.durationMinutes), location: clean(body.location), classPrice: Number(body.classPrice || 125) * 100, classWithKitPrice: Number(body.classWithKitPrice || 150) * 100, maxStudents: Number(body.maxStudents || 10), status: clean(body.status || 'open'), visibility, privateAccessToken: visibility === 'private' ? privateAccessToken() : null };
  if (!course.title || !course.startsAt || !Number.isInteger(course.durationMinutes) || course.durationMinutes < 15 || course.durationMinutes % 15 !== 0 || !course.location || !Number.isFinite(course.classPrice) || !Number.isFinite(course.classWithKitPrice) || course.maxStudents < 6 || course.maxStudents > 10 || !['public', 'private'].includes(course.visibility)) return error('Enter an expected class length in 15-minute increments. Class size must be between 6 and 10 students.');
  await env.DB.prepare('INSERT INTO classes (id, title, starts_at, duration_minutes, location, class_price_cents, class_with_kit_price_cents, max_students, status, visibility, private_access_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(course.id, course.title, course.startsAt, course.durationMinutes, course.location, course.classPrice, course.classWithKitPrice, course.maxStudents, course.status, course.visibility, course.privateAccessToken).run();
  return json({ id: course.id, privateAccessToken: course.privateAccessToken }, 201);
}

async function updateClass(request, env, classId) {
  const body = await request.json();
  const existing = await env.DB.prepare('SELECT * FROM classes WHERE id = ?').bind(classId).first();
  if (!existing) return error('Class not found.', 404);
  const course = {
    title: clean(body.title ?? existing.title),
    startsAt: clean(body.startsAt ?? existing.starts_at),
    durationMinutes: body.durationMinutes === undefined ? existing.duration_minutes : Number(body.durationMinutes),
    location: clean(body.location ?? existing.location),
    classPrice: Math.round(Number(body.classPrice ?? existing.class_price_cents / 100) * 100),
    classWithKitPrice: Math.round(Number(body.classWithKitPrice ?? existing.class_with_kit_price_cents / 100) * 100),
    maxStudents: Number(body.maxStudents ?? existing.max_students),
    status: clean(body.status ?? existing.status),
    visibility: clean(body.visibility ?? existing.visibility ?? 'public'),
    privateAccessToken: asBoolean(body.regeneratePrivateLink) && (body.visibility ?? existing.visibility) === 'private' ? privateAccessToken() : existing.private_access_token
  };
  if (!course.title || !course.startsAt || (course.durationMinutes !== null && (!Number.isInteger(course.durationMinutes) || course.durationMinutes < 15 || course.durationMinutes % 15 !== 0)) || !course.location || !Number.isFinite(course.classPrice) || !Number.isFinite(course.classWithKitPrice) || course.maxStudents < 6 || course.maxStudents > 10 || !['open', 'closed', 'cancelled'].includes(course.status) || !['public', 'private'].includes(course.visibility)) return error('Enter an expected class length in 15-minute increments. Class size must be between 6 and 10 students.');
  await env.DB.prepare('UPDATE classes SET title = ?, starts_at = ?, duration_minutes = ?, location = ?, class_price_cents = ?, class_with_kit_price_cents = ?, max_students = ?, status = ?, visibility = ?, private_access_token = ? WHERE id = ?')
    .bind(course.title, course.startsAt, course.durationMinutes, course.location, course.classPrice, course.classWithKitPrice, course.maxStudents, course.status, course.visibility, course.visibility === 'private' ? course.privateAccessToken : null, classId).run();
  return json({ ok: true, privateAccessToken: course.visibility === 'private' ? course.privateAccessToken : null });
}

async function updateRegistration(request, env, registrationId) {
  const body = await request.json();
  const status = clean(body.paymentStatus);
  if (!['awaiting_payment', 'paid', 'refunded', 'cancelled'].includes(status)) return error('Invalid payment status.');
  await env.DB.prepare("UPDATE registrations SET payment_status = ?, paid_at = CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE paid_at END WHERE id = ?").bind(status, status, registrationId).run();
  return json({ ok: true });
}

async function kitOrders(env) {
  const { results } = await env.DB.prepare('SELECT * FROM kit_orders ORDER BY created_at DESC').all();
  return results;
}

async function updateKitOrder(request, env, orderId) {
  const body = await request.json();
  const status = clean(body.paymentStatus);
  if (!['awaiting_payment', 'paid', 'refunded', 'cancelled'].includes(status)) return error('Invalid payment status.');
  await env.DB.prepare("UPDATE kit_orders SET payment_status = ?, paid_at = CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE paid_at END WHERE id = ?").bind(status, status, orderId).run();
  return json({ ok: true });
}

async function registrations(env, classId) {
  const sql = `SELECT r.*, c.title AS class_title, c.starts_at AS class_starts_at FROM registrations r JOIN classes c ON c.id = r.class_id ${classId ? 'WHERE r.class_id = ?' : ''} ORDER BY c.starts_at ASC, r.created_at ASC`;
  const statement = env.DB.prepare(sql);
  const { results } = classId ? await statement.bind(classId).all() : await statement.all();
  return results;
}

function csv(rows) {
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return ['Email*,First Name*,Last Name*,Language', ...rows.map((row) => [row.email, row.first_name, row.last_name, row.language].map(escape).join(','))].join('\n');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = cors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...corsHeaders, 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'access-control-allow-headers': 'Authorization,Content-Type', 'access-control-max-age': '86400' } });
    try {
      if (request.method === 'GET' && url.pathname === '/api/classes') return json(await listClasses(env), 200, corsHeaders);
      if (request.method === 'GET' && url.pathname.startsWith('/api/private-classes/')) {
        const course = await privateClass(env, decodeURIComponent(url.pathname.split('/').pop()));
        return course ? json(course, 200, corsHeaders) : error('This private class link is no longer active.', 404);
      }
      if (request.method === 'GET' && url.pathname === '/api/public-config') return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null }, 200, corsHeaders);
      if (request.method === 'POST' && url.pathname === '/api/registrations') { const response = await createRegistration(request, env); return new Response(response.body, { status: response.status, headers: { ...JSON_HEADERS, ...corsHeaders } }); }
      if (request.method === 'POST' && url.pathname === '/api/kit-orders') { const response = await createKitOrder(request, env); return new Response(response.body, { status: response.status, headers: { ...JSON_HEADERS, ...corsHeaders } }); }
      if (request.method === 'POST' && url.pathname === '/api/admin/login') { const response = await adminLogin(request, env); return new Response(response.body, { status: response.status, headers: { ...JSON_HEADERS, ...corsHeaders } }); }
      if (!await authenticate(request, env)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...JSON_HEADERS, ...corsHeaders } });
      if (request.method === 'GET' && url.pathname === '/api/admin/classes') return json(await listClasses(env, true), 200, corsHeaders);
      if (request.method === 'POST' && url.pathname === '/api/admin/classes') { const response = await createClass(request, env); return new Response(response.body, { status: response.status, headers: { ...JSON_HEADERS, ...corsHeaders } }); }
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/admin/classes/')) { const response = await updateClass(request, env, url.pathname.split('/').pop()); return new Response(response.body, { status: response.status, headers: { ...JSON_HEADERS, ...corsHeaders } }); }
      if (request.method === 'GET' && url.pathname === '/api/admin/registrations') return json(await registrations(env, url.searchParams.get('classId')), 200, corsHeaders);
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/admin/registrations/')) { const response = await updateRegistration(request, env, url.pathname.split('/').pop()); return new Response(response.body, { status: response.status, headers: { ...JSON_HEADERS, ...corsHeaders } }); }
      if (request.method === 'GET' && url.pathname === '/api/admin/kit-orders') return json(await kitOrders(env), 200, corsHeaders);
      if (request.method === 'PATCH' && url.pathname.startsWith('/api/admin/kit-orders/')) { const response = await updateKitOrder(request, env, url.pathname.split('/').pop()); return new Response(response.body, { status: response.status, headers: { ...JSON_HEADERS, ...corsHeaders } }); }
      if (request.method === 'GET' && url.pathname === '/api/admin/export.csv') { const rows = (await registrations(env)).filter((row) => row.payment_status === 'paid'); return new Response(csv(rows), { headers: { ...corsHeaders, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="protrainings-registrations.csv"' } }); }
      return new Response('Prepared Paws API', { status: 200, headers: corsHeaders });
    } catch (cause) { return new Response(JSON.stringify({ error: 'Unable to complete that request.' }), { status: 500, headers: { ...JSON_HEADERS, ...corsHeaders } }); }
  }
};
