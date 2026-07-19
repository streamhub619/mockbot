// src/utils/mailer.js
// Sends emails via SMTP when configured.
// In development (no SMTP_HOST set), prints the reset link to the terminal
// so the feature works without any email setup.

const nodemailer = require('nodemailer');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

// Build a transporter only when SMTP credentials are present
function getTransporter() {
  if (!process.env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send a password reset email.
 * @param {string} toEmail   Recipient email address
 * @param {string} toName    Recipient display name
 * @param {string} token     Reset token (64-char hex)
 */
async function sendPasswordResetEmail(toEmail, toName, token) {
  const resetLink = `${FRONTEND_URL}/reset-password.html?token=${token}`;
  const firstName = toName?.split(' ')[0] || 'there';

  const transporter = getTransporter();

  if (!transporter) {
    // ── Dev mode: log to console instead of sending ───────────────────────
    console.log('\n  ┌─ MockBot Password Reset (DEV MODE) ─────────────────────');
    console.log(`  │  To      : ${toEmail}`);
    console.log(`  │  Reset   : ${resetLink}`);
    console.log('  └──────────────────────────────────────────────────────────\n');
    return;
  }

  // ── Production: send real email ───────────────────────────────────────────
  const from = process.env.EMAIL_FROM || `MockBot <${process.env.SMTP_USER}>`;

  await transporter.sendMail({
    from,
    to:      toEmail,
    subject: 'Reset your MockBot password',
    text: `Hi ${firstName},\n\nYou requested a password reset.\n\nClick the link below to set a new password (expires in 1 hour):\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.\n\n— MockBot`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f5f7f4;border-radius:12px;">
        <h2 style="font-size:22px;color:#2b2926;margin-bottom:8px;">Reset your password</h2>
        <p style="color:#4a4742;">Hi ${firstName},</p>
        <p style="color:#4a4742;">You requested a password reset for your MockBot account.</p>
        <a href="${resetLink}"
           style="display:inline-block;margin:20px 0;padding:12px 24px;background:#4f8577;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
          Reset my password
        </a>
        <p style="color:#8b948e;font-size:13px;">This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e6e9e7;margin:24px 0;">
        <p style="color:#8b948e;font-size:12px;">MockBot — Practice at your own pace.</p>
      </div>`,
  });
}

module.exports = { sendPasswordResetEmail };
