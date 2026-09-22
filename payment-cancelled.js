const API_URL = 'https://prepared-paws-api.salcido-heriberto.workers.dev';
const details = new URLSearchParams(window.location.search);
const orderId = details.get('order_id');
const orderType = details.get('order_type');
const button = document.getElementById('retry-payment');
const message = document.getElementById('payment-message');

if (!orderId || !['class_registration', 'kit_order'].includes(orderType)) {
  button.hidden = true;
  message.textContent = 'Your payment was not completed. Please return to Prepared Paws to start again, or contact us if you need help.';
}

button.addEventListener('click', async () => {
  button.disabled = true;
  button.textContent = 'Opening secure checkout...';
  try {
    const response = await fetch(`${API_URL}/api/payment-retry`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId, orderType }),
    });
    const result = await response.json();
    if (!response.ok || !result.checkoutUrl) throw new Error(result.error || 'Unable to restart secure checkout.');
    window.location.assign(result.checkoutUrl);
  } catch (cause) {
    button.disabled = false;
    button.textContent = 'Return to secure checkout';
    message.textContent = cause.message || 'Unable to restart secure checkout. Please contact Prepared Paws for help.';
  }
});
