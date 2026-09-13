const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const APP_ORIGIN = 'https://salseedoh.github.io';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
const error = (message, status = 400) => json({ error: message }, status);
const clean = (value) => String(value ?? '').trim();
const id = () => crypto.randomUUID();
const asBoolean = (value) => value === true || value === 1 || value === '1';
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

function cors(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = new Set([APP_ORIGIN, ...(env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean)]);
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

async function listClasses(env, includeAll = false) {
  const query = includeAll
    ? 'SELECT * FROM classes ORDER BY starts_at ASC'
    : "SELECT * FROM classes WHERE status = 'open' AND starts_at >= datetime('now', '-1 day') ORDER BY starts_at ASC";
  const { results } = await env.DB.prepare(query).all();
  return results.map(mapClass);
}

async function createRegistration(request, env) {
  const body = await request.json();
  const classId = clean(body.classId);
  const email = clean(body.email).toLowerCase();
  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  const language = clean(body.language || 'english').toLowerCase();
  const kitSelected = asBoolean(body.kitSelected);
  if (!classId || !/^\S+@\S+\.\S+$/.test(email) || !firstName || !lastName) return error('Please provide an email, first name, and last name.');
  const course = await env.DB.prepare("SELECT * FROM classes WHERE id = ? AND status = 'open'").bind(classId).first();
  if (!course) return error('This class is no longer open for registration.', 404);
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
  const course = { id: id(), title: clean(body.title), startsAt: clean(body.startsAt), location: clean(body.location), classPrice: Number(body.classPrice || 125) * 100, classWithKitPrice: Number(body.classWithKitPrice || 150) * 100, maxStudents: Number(body.maxStudents || 10), status: clean(body.status || 'open') };
  if (!course.title || !course.startsAt || !course.location || !Number.isFinite(course.classPrice) || !Number.isFinite(course.classWithKitPrice) || course.maxStudents < 6 || course.maxStudents > 10) return error('Class size must be between 6 and 10 students.');
  await env.DB.prepare('INSERT INTO classes (id, title, starts_at, location, class_price_cents, class_with_kit_price_cents, max_students, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(course.id, course.title, course.startsAt, course.location, course.classPrice, course.classWithKitPrice, course.maxStudents, course.status).run();
  return json({ id: course.id }, 201);
}

async function updateClass(request, env, classId) {
  const body = await request.json();
  const existing = await env.DB.prepare('SELECT * FROM classes WHERE id = ?').bind(classId).first();
  if (!existing) return error('Class not found.', 404);
  const course = {
    title: clean(body.title ?? existing.title),
    startsAt: clean(body.startsAt ?? existing.starts_at),
    location: clean(body.location ?? existing.location),
    classPrice: Math.round(Number(body.classPrice ?? existing.class_price_cents / 100) * 100),
    classWithKitPrice: Math.round(Number(body.classWithKitPrice ?? existing.class_with_kit_price_cents / 100) * 100),
    maxStudents: Number(body.maxStudents ?? existing.max_students),
    status: clean(body.status ?? existing.status)
  };
  if (!course.title || !course.startsAt || !course.location || !Number.isFinite(course.classPrice) || !Number.isFinite(course.classWithKitPrice) || course.maxStudents < 6 || course.maxStudents > 10 || !['open', 'closed', 'cancelled'].includes(course.status)) return error('Class size must be between 6 and 10 students.');
  await env.DB.prepare('UPDATE classes SET title = ?, starts_at = ?, location = ?, class_price_cents = ?, class_with_kit_price_cents = ?, max_students = ?, status = ? WHERE id = ?')
    .bind(course.title, course.startsAt, course.location, course.classPrice, course.classWithKitPrice, course.maxStudents, course.status, classId).run();
  return json({ ok: true });
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
