const WEBSITE_URL = 'https://preparedpaws.com';
const LOGO_URL = `${WEBSITE_URL}/prepared-paws-logo.png`;
const SOCIAL_LINKS = `
  <a href="https://www.facebook.com/preparedpaws" style="color:#1e5fa8;text-decoration:none;">Facebook</a>
  <span style="color:#9a9a9a;padding:0 8px;">|</span>
  <a href="https://www.instagram.com/preparedpawsfirstaid" style="color:#1e5fa8;text-decoration:none;">Instagram</a>`;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

function formatClassDate(startsAt) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(startsAt));
}

function formatClassTime(startsAt) {
  return `${new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).format(new Date(startsAt))} Central Time`;
}

function formatDuration(minutes) {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return 'Please allow approximately the scheduled class time.';
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return [hours ? `${hours} hour${hours === 1 ? '' : 's'}` : '', remainder ? `${remainder} minutes` : ''].filter(Boolean).join(' ');
}

function textClassDetails(course) {
  return `Class: ${course.class_title}\nDate: ${formatClassDate(course.class_starts_at)}\nTime: ${formatClassTime(course.class_starts_at)}\nLocation: ${course.class_location}\nExpected duration: ${formatDuration(course.class_duration_minutes)}`;
}

function emailShell({ preview, body, textBody }) {
  return {
    htmlbody: `<!doctype html><html><body style="margin:0;background:#eef7fb;font-family:Arial,Helvetica,sans-serif;color:#183b67;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef7fb;padding:28px 12px;"><tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf9;border-radius:18px;overflow:hidden;box-shadow:0 10px 28px rgba(32,73,113,.12);">
          <tr><td align="center" style="padding:28px 32px 18px;"><a href="${WEBSITE_URL}"><img src="${LOGO_URL}" alt="Prepared Paws" width="210" style="display:block;max-width:210px;height:auto;border:0;"></a></td></tr>
          <tr><td style="padding:8px 38px 32px;line-height:1.55;font-size:16px;">${body}</td></tr>
          <tr><td align="center" style="background:#e7f3fb;padding:22px 28px;font-size:13px;line-height:1.6;color:#46627c;">
            <a href="${WEBSITE_URL}" style="color:#1e5fa8;text-decoration:none;font-weight:bold;">preparedpaws.com</a><br>${SOCIAL_LINKS}<br>
            <span style="font-size:12px;">Prepared Paws Pet First Aid &amp; CPR Training</span>
          </td></tr>
        </table>
      </td></tr></table>
    </body></html>`,
    textbody: textBody,
  };
}

function classEmail(registration) {
  const firstName = escapeHtml(registration.first_name);
  const details = textClassDetails(registration);
  const isVirtual = Boolean(registration.virtual_join_url);
  const joinLink = isVirtual
    ? `<p style="margin:0 0 22px;"><a href="${escapeHtml(registration.virtual_join_url)}" style="display:inline-block;background:#3678d7;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:6px;">Join Zoom class</a></p>`
    : '';
  const preparation = isVirtual
    ? `<p><strong>Please have these items ready for class:</strong></p>
      <ul style="padding-left:22px;margin-top:0;"><li>One bath-sized towel</li><li>A 6-foot leash or similar, soft non-abrasive strap</li></ul>
      <p>Please do not use a retractable leash; it does not work well with the demonstrations.</p>
      <p><strong>Please keep live pets safely at home.</strong> We provide demo dogs for hands-on practice.</p>`
    : `<p><strong>Please bring:</strong></p>
      <ul style="padding-left:22px;margin-top:0;"><li>One bath-sized towel</li><li>A 6-foot leash or similar, soft non-abrasive strap</li></ul>
      <p>Please do not bring a retractable leash; it does not work well with the demonstrations.</p>
      <p><strong>Please leave live pets at home.</strong> We provide demo dogs for hands-on practice. These demo dogs stay with Prepared Paws after class.</p>`;
  const kitNote = registration.kit_selected
    ? (isVirtual
      ? '<p style="margin:22px 0 0;"><strong>Your Prepared Paws first aid kit is included.</strong> We will contact you separately to arrange how you receive it.</p>'
      : '<p style="margin:22px 0 0;"><strong>Your Prepared Paws first aid kit will be provided when you arrive for class.</strong> There is no separate pickup needed.</p>')
    : '';
  const subject = registration.kit_selected ? 'Your Prepared Paws Class + Kit Is Confirmed' : 'Your Prepared Paws Class Is Confirmed';
  const body = `<p style="margin-top:0;">Hi ${firstName},</p>
    <p>Thank you for registering with Prepared Paws. Your payment was received and your place is confirmed.</p>
    <div style="background:#eef7fb;border-left:4px solid #3678d7;border-radius:4px;padding:16px 18px;margin:24px 0;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#2c68b5;font-weight:bold;margin-bottom:8px;">Your class details</div>
      <strong>${escapeHtml(registration.class_title)}</strong><br>
      ${escapeHtml(formatClassDate(registration.class_starts_at))}<br>
      ${escapeHtml(formatClassTime(registration.class_starts_at))}<br>
      ${escapeHtml(registration.class_location)}<br>
      Expected duration: ${escapeHtml(formatDuration(registration.class_duration_minutes))}
    </div>
    ${joinLink}
    ${preparation}
    ${kitNote}
    <p>Watch for a separate email from ProTrainings within the next few days. It will include your username and password for the ProTrainings site, where you can download your certificate after completing the class.</p>
    <p style="margin-bottom:0;">Questions about your class? Reply to this email and our class team will be happy to help.</p>`;
  const preparationText = isVirtual
    ? 'Please have these items ready for class:\n- One bath-sized towel\n- A 6-foot leash or similar, soft non-abrasive strap\n\nPlease do not use a retractable leash; it does not work well with the demonstrations.\n\nPlease keep live pets safely at home. We provide demo dogs for hands-on practice.'
    : 'Please bring:\n- One bath-sized towel\n- A 6-foot leash or similar, soft non-abrasive strap\n\nPlease do not bring a retractable leash; it does not work well with the demonstrations.\n\nPlease leave live pets at home. We provide demo dogs for hands-on practice. These demo dogs stay with Prepared Paws after class.';
  const kitText = registration.kit_selected
    ? (isVirtual ? '\n\nYour Prepared Paws first aid kit is included. We will contact you separately to arrange how you receive it.' : '\n\nYour Prepared Paws first aid kit will be provided when you arrive for class. There is no separate pickup needed.')
    : '';
  const textBody = `Hi ${registration.first_name},\n\nThank you for registering with Prepared Paws. Your payment was received and your place is confirmed.\n\n${details}${isVirtual ? `\n\nJoin Zoom class: ${registration.virtual_join_url}` : ''}\n\n${preparationText}${kitText}\n\nWatch for a separate email from ProTrainings within the next few days. It will include your username and password for the ProTrainings site, where you can download your certificate after completing the class.\n\nQuestions about your class? Reply to this email and our class team will be happy to help.\n\nPrepared Paws\n${WEBSITE_URL}`;
  return { subject, ...emailShell({ preview: 'Your Prepared Paws class registration is confirmed.', body, textBody }), replyTo: 'classes@preparedpaws.com' };
}

function kitEmail(order) {
  const firstName = escapeHtml(order.first_name);
  const subject = 'Your Prepared Paws First Aid Kit Is Ready for Pickup';
  const body = `<p style="margin-top:0;">Hi ${firstName},</p>
    <p>Thank you for your Prepared Paws first aid kit order. Your payment was received, and your kit is ready for local pickup.</p>
    <div style="background:#eef7fb;border-left:4px solid #3678d7;border-radius:4px;padding:16px 18px;margin:24px 0;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#2c68b5;font-weight:bold;margin-bottom:8px;">Pickup availability</div>
      Monday–Friday: 5:30 PM–8:00 PM<br>
      Saturday–Sunday: 9:00 AM–8:00 PM
    </div>
    <p><strong>Please reply to this email</strong> with your preferred pickup location, date, and approximate time so we can coordinate with you.</p>
    <p><strong>Pickup locations:</strong></p>
    <ol style="padding-left:22px;margin-top:0;"><li style="margin-bottom:10px;"><strong>Walmart Neighborhood Market Parking Lot</strong><br>1515 Justin Rd, Lewisville, TX 75077</li><li style="margin-bottom:10px;"><strong>Lewisville Police Department</strong><br>1187 W Main St, Lewisville, TX 75067</li><li style="margin-bottom:10px;"><strong>Highland Village Police Department</strong><br>1000 Highland Village Rd, Highland Village, TX 75077</li><li><strong>Flower Mound Police Department</strong><br>4150 Kirkpatrick Ln, Flower Mound, TX 75028</li></ol>
    <p style="margin-bottom:0;">We look forward to getting your kit to you!</p>`;
  const textBody = `Hi ${order.first_name},\n\nThank you for your Prepared Paws first aid kit order. Your payment was received, and your kit is ready for local pickup.\n\nPickup availability:\nMonday-Friday: 5:30 PM-8:00 PM\nSaturday-Sunday: 9:00 AM-8:00 PM\n\nPlease reply to this email with your preferred pickup location, date, and approximate time so we can coordinate with you.\n\nPickup locations:\n1. Walmart Neighborhood Market Parking Lot\n1515 Justin Rd, Lewisville, TX 75077\n\n2. Lewisville Police Department\n1187 W Main St, Lewisville, TX 75067\n\n3. Highland Village Police Department\n1000 Highland Village Rd, Highland Village, TX 75077\n\n4. Flower Mound Police Department\n4150 Kirkpatrick Ln, Flower Mound, TX 75028\n\nWe look forward to getting your kit to you!\n\nPrepared Paws\n${WEBSITE_URL}`;
  return { subject, ...emailShell({ preview: 'Your Prepared Paws first aid kit is ready for local pickup.', body, textBody }), replyTo: 'support@preparedpaws.com' };
}

export function confirmationEmail(orderType, order) {
  return orderType === 'class_registration' ? classEmail(order) : kitEmail(order);
}

export function adminOrderNotification(orderType, order) {
  const isClass = orderType === 'class_registration';
  const includesKit = isClass && Boolean(order.kit_selected);
  const orderLabel = isClass ? (includesKit ? 'Class + Kit' : 'Class Only') : 'Kit Only';
  const amount = `$${(Number(order.amount_cents) / 100).toFixed(2)}`;
  const customer = `${escapeHtml(order.first_name)} ${escapeHtml(order.last_name)}`;
  const classDetails = isClass ? `<div style="background:#eef7fb;border-left:4px solid #3678d7;border-radius:4px;padding:16px 18px;margin:24px 0;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#2c68b5;font-weight:bold;margin-bottom:8px;">Class details</div>
      <strong>${escapeHtml(order.class_title)}</strong><br>
      ${escapeHtml(formatClassDate(order.class_starts_at))}<br>
      ${escapeHtml(formatClassTime(order.class_starts_at))}<br>
      ${escapeHtml(order.class_location)}<br>
      Expected duration: ${escapeHtml(formatDuration(order.class_duration_minutes))}
    </div>` : `<div style="background:#eef7fb;border-left:4px solid #3678d7;border-radius:4px;padding:16px 18px;margin:24px 0;"><strong>Local pickup ZIP:</strong> ${escapeHtml(order.pickup_zip)}</div>`;
  const textDetails = isClass
    ? textClassDetails(order)
    : `Local pickup ZIP: ${order.pickup_zip}`;
  const body = `<p style="margin-top:0;">A new Prepared Paws order has been paid.</p>
    <div style="background:#fff4df;border-left:4px solid #e3a64a;border-radius:4px;padding:16px 18px;margin:24px 0;"><strong>Order type:</strong> ${escapeHtml(orderLabel)}<br><strong>Amount paid:</strong> ${escapeHtml(amount)}</div>
    <p><strong>Customer:</strong> ${customer}<br><strong>Email:</strong> <a href="mailto:${escapeHtml(order.email)}" style="color:#1e5fa8;">${escapeHtml(order.email)}</a>${isClass ? `<br><strong>Language:</strong> ${escapeHtml(order.language)}` : ''}</p>
    ${classDetails}
    <p style="margin-bottom:0;font-size:13px;color:#46627c;">Stripe checkout session: ${escapeHtml(order.stripe_checkout_session_id)}</p>`;
  const textBody = `A new Prepared Paws order has been paid.\n\nOrder type: ${orderLabel}\nAmount paid: ${amount}\n\nCustomer: ${order.first_name} ${order.last_name}\nEmail: ${order.email}${isClass ? `\nLanguage: ${order.language}` : ''}\n\n${textDetails}\n\nStripe checkout session: ${order.stripe_checkout_session_id}`;
  return {
    subject: `New Prepared Paws Order — ${orderLabel} — ${amount}`,
    ...emailShell({ preview: `New paid ${orderLabel.toLowerCase()} order.`, body, textBody }),
    replyTo: isClass ? 'classes@preparedpaws.com' : 'support@preparedpaws.com',
  };
}
