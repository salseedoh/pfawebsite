const API_URL = new URLSearchParams(window.location.search).get('environment') === 'test'
  ? 'https://prepared-paws-api-test.salcido-heriberto.workers.dev'
  : 'https://prepared-paws-api.salcido-heriberto.workers.dev';

const card = document.getElementById('join-card');
const title = document.getElementById('join-title');
const message = document.getElementById('join-message');
const meeting = document.getElementById('jaas-meeting');

function showError(text) {
  card.classList.add('join-error');
  title.textContent = 'This class link is unavailable';
  message.textContent = text;
}

function loadJaasApi(appId) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://8x8.vc/${encodeURIComponent(appId)}/external_api.js`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Unable to load the virtual classroom. Please check your connection and try again.'));
    document.head.append(script);
  });
}

async function joinClass() {
  const token = window.location.hash.slice(1);
  if (!token) {
    showError('Please use the private joining link from your Prepared Paws confirmation email.');
    return;
  }
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  try {
    const response = await fetch(`${API_URL}/api/virtual-join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'This virtual class link is unavailable.');
    await loadJaasApi(body.appId);
    if (!window.JitsiMeetExternalAPI) throw new Error('Unable to start the virtual classroom. Please refresh and try again.');
    card.classList.add('ready');
    new window.JitsiMeetExternalAPI('8x8.vc', { roomName: `${body.appId}/${body.roomName}`, jwt: body.jwt, parentNode: meeting, width: '100%', height: 720 });
  } catch (cause) {
    showError(cause.message || 'Please contact Prepared Paws if you need help joining your class.');
  }
}

joinClass();
