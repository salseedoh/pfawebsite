const encoder = new TextEncoder();

function hexToBytes(value) {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  return bytes;
}

export async function createStripeCheckoutSession(fields, secretKey) {
  if (!secretKey) throw new Error('Stripe payments have not been configured.');
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
      // Required for Checkout's per-session payment-method exclusions.
      'Stripe-Version': '2025-09-30.clover',
    },
    body: new URLSearchParams(fields),
  });
  const body = await response.json();
  if (!response.ok || !body.url || !body.id) throw new Error(body?.error?.message || 'Unable to start secure checkout.');
  return body;
}

export async function expireStripeCheckoutSession(sessionId, secretKey) {
  if (!sessionId || !secretKey) throw new Error('Stripe payments have not been configured.');
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secretKey}` },
  });
  if (!response.ok) throw new Error('Unable to restart secure checkout. Please contact us for help.');
}

export async function retrieveStripeCheckoutSession(sessionId, secretKey) {
  if (!sessionId || !secretKey) throw new Error('Stripe payments have not been configured.');
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { authorization: `Bearer ${secretKey}` },
  });
  const body = await response.json();
  if (!response.ok || !body.url) throw new Error('Unable to reopen secure checkout.');
  return body;
}

export async function verifyStripeWebhookSignature(payload, signatureHeader, webhookSecret, toleranceSeconds = 300) {
  if (!signatureHeader || !webhookSecret) return false;
  const fields = signatureHeader.split(',').map((entry) => entry.split('=', 2));
  const timestamp = Number(fields.find(([key]) => key === 't')?.[1]);
  const signatures = fields.filter(([key]) => key === 'v1').map(([, value]) => hexToBytes(value)).filter(Boolean);
  if (!Number.isFinite(timestamp) || !signatures.length || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signedPayload = encoder.encode(`${timestamp}.${payload}`);
  for (const signature of signatures) {
    if (await crypto.subtle.verify('HMAC', key, signature, signedPayload)) return true;
  }
  return false;
}
