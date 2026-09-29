const nodemailer = require('nodemailer');
const dns = require('dns');
const { query } = require('../config/database');

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

function getContactRecipient() {
  return (process.env.CONTACT_EMAIL || 'contact@houseofdahlia.in').trim();
}

function getAdminRecipient() {
  return (
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    'shophouseofdahliaofficial@gmail.com'
  ).trim();
}

function formatInr(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const emailService = process.env.EMAIL_SERVICE || 'gmail';
  const emailUser = (
    process.env.EMAIL_USER ||
    process.env.SMTP_USER ||
    'shophouseofdahliaofficial@gmail.com'
  ).trim();

  const rawPass = process.env.EMAIL_PASS || process.env.SMTP_PASS || 'wurc cdxo nffw ygum';
  const emailPass = rawPass ? String(rawPass).replace(/[\s"']/g, '') : ''; // Strip spaces & quotes from Google App Passwords

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

  const timeoutOptions = {
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };

  if (smtpHost && emailUser && emailPass && emailService !== 'gmail') {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: emailUser, pass: emailPass },
      tls: {
        rejectUnauthorized: false,
      },
      ...timeoutOptions,
    });
  } else if (emailUser && emailPass) {
    // Explicitly configure smtp.gmail.com on port 587 with STARTTLS to avoid IPv6 routing errors
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Port 587 uses STARTTLS
      auth: { user: emailUser, pass: emailPass },
      tls: {
        rejectUnauthorized: false,
      },
      ...timeoutOptions,
    });
  }

  return transporter;
}

/**
 * Unified Email Dispatcher (Supports HTTPS REST APIs for Resend & Brevo + SMTP fallback)
 */
async function sendEmailPayload({ from, to, replyTo, subject, html, text }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const recipient = to || getAdminRecipient();

  // 1. Try Resend REST API (HTTPS Port 443 - 100% unrestricted on Render/Cloud)
  if (resendApiKey) {
    try {
      const sender = process.env.RESEND_FROM || (process.env.EMAIL_FROM && !process.env.EMAIL_FROM.includes('@gmail.com') ? process.env.EMAIL_FROM : 'House of Dahlia <onboarding@resend.dev>');
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: sender,
          to: Array.isArray(recipient) ? recipient : [recipient],
          reply_to: replyTo || undefined,
          subject,
          html,
          text,
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        console.log(`[EmailService] Email sent via Resend HTTPS to ${recipient}: ${data.id}`);
        return { success: true, messageId: data.id, provider: 'resend' };
      }
      console.warn('[EmailService] Resend API error response:', data);
    } catch (resendErr) {
      console.error('[EmailService] Failed to send via Resend API:', resendErr?.message || resendErr);
    }
  }

  // 2. Try Brevo REST API (HTTPS Port 443 - 100% unrestricted on Render/Cloud)
  const resolvedBrevoKey = brevoApiKey || process.env.SIB_API_KEY;
  if (resolvedBrevoKey) {
    try {
      const senderEmail = (
        process.env.BREVO_SENDER_EMAIL ||
        process.env.EMAIL_USER ||
        process.env.SMTP_USER ||
        'shophouseofdahliaofficial@gmail.com'
      ).trim();
      const senderName = (process.env.BREVO_SENDER_NAME || 'House of Dahlia').trim();

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': resolvedBrevoKey.trim(),
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: Array.isArray(recipient)
            ? recipient.map(e => ({ email: e }))
            : [{ email: recipient }],
          replyTo: replyTo ? { email: replyTo } : undefined,
          subject,
          htmlContent: html,
          textContent: text,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.messageId || data.id)) {
        const msgId = data.messageId || data.id;
        console.log(`[EmailService] Email sent via Brevo HTTPS to ${recipient}: ${msgId}`);
        return { success: true, messageId: msgId, provider: 'brevo' };
      }
      console.warn('[EmailService] Brevo API error response:', data);
      return { success: false, error: data.message || JSON.stringify(data), provider: 'brevo' };
    } catch (brevoErr) {
      console.error('[EmailService] Failed to send via Brevo API:', brevoErr?.message || brevoErr);
      return { success: false, error: brevoErr?.message || 'Brevo network error', provider: 'brevo' };
    }
  }

  // 3. Fallback to Nodemailer SMTP
  const mailTransporter = getTransporter();
  const authUser = process.env.EMAIL_USER || process.env.SMTP_USER || recipient;
  const mailOptions = {
    from: from || process.env.EMAIL_FROM || `"House of Dahlia" <${authUser}>`,
    to: recipient,
    replyTo: replyTo || undefined,
    subject,
    html,
    text,
  };

  if (mailTransporter) {
    try {
      const info = await mailTransporter.sendMail(mailOptions);
      console.log(`[EmailService] Email sent via SMTP to ${recipient}: ${info.messageId}`);
      return { success: true, messageId: info.messageId, provider: 'smtp' };
    } catch (err) {
      console.error('[EmailService] Failed to send email via SMTP:', err.message);
      return { success: false, error: err.message };
    }
  }

  console.log(`[EmailService] SMTP credentials not configured. Email simulated for ${recipient}`);
  return { success: true, simulated: true };
}

/**
 * Send Contact Inquiry Notification to contact@houseofdahlia.in
 */
async function sendContactInquiry({ name, email, topic, subject, message }) {
  const recipient = getContactRecipient();
  const authUser = process.env.EMAIL_USER || process.env.SMTP_USER || recipient;

  return sendEmailPayload({
    from: process.env.EMAIL_FROM || `"House of Dahlia" <${authUser}>`,
    to: recipient,
    replyTo: email,
    subject: `[New Inquiry - ${topic || 'Contact'}] ${subject || 'Website Inquiry'} from ${name || email}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #faf9f6; color: #1a1a1a; border-radius: 12px;">
        <div style="border-bottom: 2px solid #530000; padding-bottom: 12px; margin-bottom: 20px;">
          <h2 style="color: #530000; margin: 0; font-size: 22px;">New Contact Inquiry • House of Dahlia</h2>
          <p style="margin: 4px 0 0 0; color: #666; font-size: 13px;">Received via website contact form</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #888; width: 100px;"><strong>Name:</strong></td>
            <td style="padding: 8px 0; color: #111;">${name || 'Not provided'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;"><strong>Email:</strong></td>
            <td style="padding: 8px 0; color: #111;"><a href="mailto:${email}" style="color: #530000; text-decoration: none; font-weight: bold;">${email}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;"><strong>Topic:</strong></td>
            <td style="padding: 8px 0; color: #111;"><span style="background: #fff0f3; color: #530000; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${topic || 'General'}</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #888;"><strong>Subject:</strong></td>
            <td style="padding: 8px 0; color: #111;">${subject || 'No Subject'}</td>
          </tr>
        </table>

        <div style="background: #ffffff; padding: 18px; border-radius: 8px; border-left: 4px solid #530000; margin-bottom: 24px;">
          <h4 style="margin: 0 0 8px 0; color: #530000; font-size: 13px; text-transform: uppercase;">Message Content:</h4>
          <p style="margin: 0; line-height: 1.6; white-space: pre-wrap; font-size: 15px; color: #222;">${message}</p>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject || 'Inquiry regarding House of Dahlia')}" style="background-color: #530000; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
            Reply to ${name || 'Customer'}
          </a>
        </div>

        <div style="margin-top: 30px; text-align: center; border-top: 1px solid #e5e5e5; padding-top: 14px; font-size: 12px; color: #999;">
          House of Dahlia • Studio Inquiries Concierge
        </div>
      </div>
    `,
    text: `New Contact Inquiry from ${name || 'Customer'} (${email})\nTopic: ${topic || 'General'}\nSubject: ${subject || 'No Subject'}\n\nMessage:\n${message}`,
  });
}

/**
 * Send Instant Order Alert to Admin
 */
async function sendAdminOrderNotification(order = {}) {
  const recipient = getAdminRecipient();
  const authUser = process.env.EMAIL_USER || process.env.SMTP_USER || recipient;
  const adminUrl = process.env.ADMIN_URL || 'https://houseofdahlia.in';

  let orderData = order;
  let items = [];
  let customerName = order?.customerName || 'Customer';
  let customerEmail = order?.customerEmail || '';
  let customerPhone = order?.customerPhone || '';
  let deliveryAddress = order?.deliveryAddress || order?.delivery_address || {};

  // Fetch full details if only ID or partial order is provided
  if (order?.id || order?.order_number || order?.orderNumber) {
    try {
      const orderIdentifier = String(order?.order_number || order?.orderNumber || order?.id || '');
      const orderRes = await query(
        `
        SELECT
          o.*,
          COALESCE(u.name, 'Customer') AS user_name,
          COALESCE(u.email, '') AS user_email,
          COALESCE(u.phone, '') AS user_phone
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        WHERE o.order_number = $1 OR o.id::text = $1
        LIMIT 1
        `,
        [orderIdentifier]
      );
      if (orderRes.rows[0]) {
        const row = orderRes.rows[0];
        orderData = { ...row, ...orderData };
        customerName = row.user_name || customerName;
        customerEmail = row.user_email || customerEmail;
        customerPhone = row.user_phone || customerPhone;
        deliveryAddress = row.delivery_address || row.shipping_address || deliveryAddress;

        const itemsRes = await query(
          `
          SELECT product_name, variation_size, quantity, unit_price, line_total
          FROM order_items
          WHERE order_id = $1
          ORDER BY id ASC
          `,
          [row.id]
        );
        items = itemsRes.rows || [];
      }
    } catch (err) {
      console.error('[EmailService] Failed to load full order for email alert:', err.message);
    }
  }

  if (typeof deliveryAddress === 'string') {
    try {
      deliveryAddress = JSON.parse(deliveryAddress);
    } catch (_) {
      deliveryAddress = { address: deliveryAddress };
    }
  }

  const orderNum = orderData.order_number || orderData.orderNumber || orderData.id || 'N/A';
  const totalAmount = orderData.total || orderData.total_amount || 0;
  const paymentMethod = String(orderData.payment_method || 'Online').toUpperCase();
  const paymentStatus = String(orderData.payment_status || 'Pending').toUpperCase();

  const formattedAddr = [
    deliveryAddress?.fullName || deliveryAddress?.name,
    deliveryAddress?.phone || customerPhone,
    deliveryAddress?.addressLine1 || deliveryAddress?.street || deliveryAddress?.address,
    deliveryAddress?.addressLine2,
    deliveryAddress?.city,
    deliveryAddress?.state,
    deliveryAddress?.pincode || deliveryAddress?.postalCode,
  ].filter(Boolean).join(', ');

  const itemsHtml = items.length > 0
    ? items.map(item => `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px 8px; font-weight: 600; color: #222;">
            ${item.product_name}
            ${item.variation_size ? `<span style="display:block; font-size:12px; color:#777; font-weight:normal;">Size: ${item.variation_size}</span>` : ''}
          </td>
          <td style="padding: 10px 8px; text-align: center; color: #555;">${item.quantity || 1}</td>
          <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #530000;">${formatInr(item.line_total || (item.unit_price * (item.quantity || 1)))}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="3" style="padding: 12px 8px; color: #666;">Standard Order Items</td></tr>`;

  return sendEmailPayload({
    from: process.env.EMAIL_FROM || `"House of Dahlia Orders" <${authUser}>`,
    to: recipient,
    replyTo: customerEmail || undefined,
    subject: `🛍️ New Order #${orderNum} received! (${formatInr(totalAmount)}) • House of Dahlia`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; background-color: #faf8f5; color: #1a1a1a; border-radius: 12px; border: 1px solid #e8e0d5;">
        
        <!-- Header -->
        <div style="background: #530000; padding: 20px 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; letter-spacing: 1px; font-weight: 700; text-transform: uppercase;">House of Dahlia</h1>
          <p style="color: #f7d5d5; margin: 6px 0 0 0; font-size: 13px; letter-spacing: 0.5px;">NEW ORDER ALERT</p>
        </div>

        <div style="background: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #eee; border-top: none;">
          
          <!-- Summary Banner -->
          <div style="background: #fff6f6; border-left: 4px solid #530000; padding: 14px 18px; margin-bottom: 22px; border-radius: 4px;">
            <div style="font-size: 18px; font-weight: bold; color: #530000;">Order #${orderNum}</div>
            <div style="font-size: 14px; color: #666; margin-top: 4px;">Total Amount: <strong style="color: #111; font-size: 16px;">${formatInr(totalAmount)}</strong> | Payment: <span style="background:#530000; color:#fff; padding:2px 6px; border-radius:3px; font-size:11px; font-weight:bold;">${paymentMethod}</span> (${paymentStatus})</div>
          </div>

          <!-- Customer Details -->
          <h3 style="font-size: 14px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin: 0 0 10px 0;">Customer Information</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
            <tr>
              <td style="padding: 4px 0; color: #666; width: 110px;">Name:</td>
              <td style="padding: 4px 0; font-weight: 600; color: #111;">${customerName}</td>
            </tr>
            ${customerPhone ? `<tr><td style="padding: 4px 0; color: #666;">Phone:</td><td style="padding: 4px 0; font-weight: 600; color: #111;"><a href="tel:${customerPhone}" style="color:#530000; text-decoration:none;">${customerPhone}</a></td></tr>` : ''}
            ${customerEmail ? `<tr><td style="padding: 4px 0; color: #666;">Email:</td><td style="padding: 4px 0; color: #111;"><a href="mailto:${customerEmail}" style="color:#530000; text-decoration:none;">${customerEmail}</a></td></tr>` : ''}
          </table>

          <!-- Shipping Address -->
          <h3 style="font-size: 14px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin: 0 0 8px 0;">Delivery Address</h3>
          <div style="background: #fdfbf7; border: 1px solid #ece4d8; padding: 12px 14px; border-radius: 6px; font-size: 14px; line-height: 1.5; color: #333; margin-bottom: 22px;">
            ${formattedAddr || 'Address details in Admin panel'}
          </div>

          <!-- Items Ordered -->
          <h3 style="font-size: 14px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; margin: 0 0 10px 0;">Items Ordered</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
            <thead>
              <tr style="background: #f4f0ea; border-bottom: 2px solid #ddd;">
                <th style="padding: 8px; text-align: left; font-size: 12px; color: #555;">Product</th>
                <th style="padding: 8px; text-align: center; font-size: 12px; color: #555;">Qty</th>
                <th style="padding: 8px; text-align: right; font-size: 12px; color: #555;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 12px 8px 4px 8px; text-align: right; font-weight: bold; color: #333;">Grand Total:</td>
                <td style="padding: 12px 8px 4px 8px; text-align: right; font-weight: bold; font-size: 16px; color: #530000;">${formatInr(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>

          <!-- Action Button -->
          <div style="text-align: center; margin-top: 26px; padding-top: 18px; border-top: 1px solid #eee;">
            <a href="${adminUrl}/admin/orders" style="background-color: #530000; color: #ffffff; padding: 12px 26px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block; letter-spacing: 0.5px;">
              View Order in Admin Panel →
            </a>
          </div>

        </div>

        <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #999;">
          House of Dahlia • Real-time Order Dispatch Engine
        </div>
      </div>
    `,
    text: `New Order Alert #${orderNum}\nCustomer: ${customerName} (${customerPhone || customerEmail})\nTotal: ${formatInr(totalAmount)}\nPayment: ${paymentMethod} (${paymentStatus})\nDelivery Address: ${formattedAddr}\nView: ${adminUrl}/admin/orders`,
  });
}

/**
 * Send Instant Subscription Alert to Admin
 */
async function sendAdminSubscriptionNotification(subscription = {}, options = {}) {
  const recipient = getAdminRecipient();
  const authUser = process.env.EMAIL_USER || process.env.SMTP_USER || recipient;
  const adminUrl = process.env.ADMIN_URL || 'https://houseofdahlia.in';

  const isTrial = Boolean(options.isTrial);
  const customerName = subscription.customerName || 'Customer';
  const productName = subscription.productName || 'Subscription Plan';
  const total = subscription.total || subscription.totalAmountPaid || subscription.totalAmount || 0;

  return sendEmailPayload({
    from: process.env.EMAIL_FROM || `"House of Dahlia Subscriptions" <${authUser}>`,
    to: recipient,
    subject: `✨ New ${isTrial ? 'Trial Subscription' : 'Subscription'} Started! • House of Dahlia`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #faf8f5; color: #1a1a1a; border-radius: 12px;">
        <div style="background: #530000; padding: 20px 24px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px;">House of Dahlia</h1>
          <p style="color: #f7d5d5; margin: 6px 0 0 0; font-size: 13px;">${isTrial ? 'NEW TRIAL SUBSCRIPTION' : 'NEW SUBSCRIPTION'}</p>
        </div>
        <div style="background: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #eee; border-top: none;">
          <h2 style="color: #530000; margin-top: 0;">${customerName} started a ${isTrial ? 'Trial' : 'Subscription'}</h2>
          <p style="font-size: 15px; color: #444;"><strong>Product/Plan:</strong> ${productName}</p>
          <p style="font-size: 15px; color: #444;"><strong>Amount:</strong> ${formatInr(total)}</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${adminUrl}/admin/subscriptions" style="background-color: #530000; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
              View Subscriptions in Admin
            </a>
          </div>
        </div>
      </div>
    `,
    text: `New Subscription Started!\nCustomer: ${customerName}\nProduct: ${productName}\nAmount: ${formatInr(total)}\nView: ${adminUrl}/admin/subscriptions`,
  });
}

/**
 * Send a test email to verify credentials
 */
async function sendTestAdminEmail(toEmail) {
  const recipient = toEmail || getAdminRecipient();
  const authUser = process.env.EMAIL_USER || process.env.SMTP_USER || recipient;

  return sendEmailPayload({
    from: process.env.EMAIL_FROM || `"House of Dahlia" <${authUser}>`,
    to: recipient,
    subject: '🧪 House of Dahlia Admin Notification Test',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #faf9f6; border-radius: 10px; border: 1px solid #530000;">
        <h2 style="color: #530000; margin: 0 0 10px 0;">Test Email Successful!</h2>
        <p style="color: #333; font-size: 14px; line-height: 1.5;">
          Your notification engine is properly connected to House of Dahlia. You will now receive instant luxury email alerts whenever a customer places an order or begins a subscription!
        </p>
        <div style="margin-top: 15px; font-size: 12px; color: #888;">
          Sent at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
        </div>
      </div>
    `,
    text: 'Test Email Successful! Your notification engine is properly connected to House of Dahlia.',
  });
}

module.exports = {
  sendContactInquiry,
  sendAdminOrderNotification,
  sendAdminSubscriptionNotification,
  sendTestAdminEmail,
  getContactRecipient,
  getAdminRecipient,
  get TARGET_CONTACT_EMAIL() { return getContactRecipient(); },
  get ADMIN_NOTIFICATION_EMAIL() { return getAdminRecipient(); },
};
