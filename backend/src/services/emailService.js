const nodemailer = require('nodemailer');

const TARGET_CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'contact@houseofdahlia.in';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
    });
  } else if (user && pass) {
    // Standard service like Gmail / Zoho / Resend
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: { user, pass },
    });
  }
  return transporter;
}

/**
 * Send Contact Inquiry Notification to contact@houseofdahlia.in
 */
async function sendContactInquiry({ name, email, topic, subject, message }) {
  const mailTransporter = getTransporter();
  const recipient = TARGET_CONTACT_EMAIL;
  const authUser = process.env.SMTP_USER || process.env.EMAIL_USER || recipient;

  const mailOptions = {
    from: process.env.EMAIL_FROM || `"House of Dahlia" <${authUser}>`,
    to: recipient,
    replyTo: `"${name || 'Customer'}" <${email}>`,
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
    text: `New Contact Inquiry from ${name || 'Customer'} (${email})
Topic: ${topic || 'General'}
Subject: ${subject || 'No Subject'}

Message:
${message}
    `,
  };

  if (mailTransporter) {
    try {
      const info = await mailTransporter.sendMail(mailOptions);
      console.log(`[EmailService] Contact inquiry sent to ${recipient}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[EmailService] Failed to send email via SMTP:', err.message);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`[EmailService] SMTP credentials not configured. Inquiry saved to database and ready to send to ${recipient}:`);
    console.log(`From: ${email}, Subject: ${subject}`);
    return { success: true, simulated: true };
  }
}

module.exports = {
  sendContactInquiry,
  TARGET_CONTACT_EMAIL,
};
