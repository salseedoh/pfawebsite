const params = new URLSearchParams(window.location.search);
const API_URL = params.get('environment') === 'test'
  ? 'https://prepared-paws-api-test.salcido-heriberto.workers.dev'
  : 'https://prepared-paws-api.salcido-heriberto.workers.dev';
const sessionId = params.get('session_id');
const icon = document.getElementById('payment-icon');
const title = document.getElementById('payment-title');
const message = document.getElementById('payment-message');
const home = document.getElementById('return-home');

function finish(nextTitle, nextMessage, state = 'complete') {
  icon.className = `payment-status-icon ${state}`;
  icon.textContent = state === 'complete' ? '\\u2713' : '!';
  title.textContent = nextTitle;
  message.textContent = nextMessage;
  home.hidden = false;
}

async function checkPayment(attempt = 0) {
  if (!sessionId) {
    finish('We could not find your payment.', 'Please contact Prepared Paws if you need help with a recent payment.', 'problem');
    return;
  }
  try {
    const response = await fetch(`${API_URL}/api/payment-status/${encodeURIComponent(sessionId)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to confirm your payment.');
    if (result.paymentStatus === 'paid') {
      const confirmation = result.orderType === 'kit_order'
        ? 'Your kit order is confirmed. Prepared Paws will contact you about local pickup.'
        : 'Your class registration is confirmed. Stripe will email your payment receipt.';
      finish('Payment confirmed', confirmation);
      return;
    }
    if (attempt < 8) {
      window.setTimeout(() => checkPayment(attempt + 1), 2500);
      return;
    }
    finish('Payment is being finalized', 'We are still confirming your payment. Please check your email shortly, or contact Prepared Paws if you need help.', 'problem');
  } catch (cause) {
    finish('We could not confirm your payment yet', 'If your payment was successful, please allow a few minutes and check your email. You can also contact Prepared Paws for help.', 'problem');
  }
}

checkPayment();
