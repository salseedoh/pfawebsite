const ZEPTOMAIL_SEND_URL = 'https://api.zeptomail.com/v1.1/email';

export async function sendZeptoMail(message, apiKey) {
  if (!apiKey) throw new Error('Transactional email has not been configured.');

  const response = await fetch(ZEPTOMAIL_SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(message),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.message !== 'OK') {
    throw new Error(body?.data?.message || body?.message || 'The transactional email provider rejected the message.');
  }
  return body;
}
