const nodemailer = require('nodemailer');

const RESET_TOKEN_TTL_MINUTES = 15;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

const getPasswordResetEmailConfig = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM, CLIENT_BASE_URL } =
    process.env;
  const port = Number(SMTP_PORT);
  const secureText = String(SMTP_SECURE || '').toLowerCase();

  if (
    !SMTP_HOST ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !['true', 'false'].includes(secureText) ||
    !SMTP_USER ||
    !SMTP_PASS ||
    !EMAIL_FROM ||
    /[\r\n]/.test(EMAIL_FROM) ||
    !CLIENT_BASE_URL
  ) {
    return null;
  }

  let clientBaseUrl;
  try {
    clientBaseUrl = new URL(CLIENT_BASE_URL);
  } catch {
    return null;
  }

  if (
    !['http:', 'https:'].includes(clientBaseUrl.protocol) ||
    clientBaseUrl.username ||
    clientBaseUrl.password ||
    clientBaseUrl.search ||
    clientBaseUrl.hash ||
    (process.env.NODE_ENV === 'production' && clientBaseUrl.protocol !== 'https:')
  ) {
    return null;
  }

  return {
    host: SMTP_HOST,
    port,
    secure: secureText === 'true',
    user: SMTP_USER,
    password: SMTP_PASS,
    from: EMAIL_FROM,
    clientBaseUrl: clientBaseUrl.toString().replace(/\/$/, '')
  };
};

const sendPasswordResetEmail = async ({ email, name, token }) => {
  const config = getPasswordResetEmailConfig();
  if (!config) {
    throw new Error('Password reset email configuration is incomplete or invalid.');
  }

  const resetUrl = `${config.clientBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(name || 'EventFlow user');
  const safeResetUrl = escapeHtml(resetUrl);
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password }
  });

  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: 'Reset your EventFlow password',
    text: `Hello ${name || 'EventFlow user'},\n\nUse this link to reset your EventFlow password. It expires in ${RESET_TOKEN_TTL_MINUTES} minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email. If the link expires, request another reset from the EventFlow sign-in page.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a"><h1 style="color:#4f46e5">EventFlow</h1><p>Hello ${safeName},</p><p>We received a request to reset your password. This link expires in ${RESET_TOKEN_TTL_MINUTES} minutes.</p><p><a href="${safeResetUrl}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px">Reset password</a></p><p>If you did not request this, you can ignore this email. If the link expires, request another reset from the <a href="${escapeHtml(`${config.clientBaseUrl}/forgot-password`)}">EventFlow sign-in page</a>.</p></div>`
  });
};

module.exports = {
  RESET_TOKEN_TTL_MINUTES,
  getPasswordResetEmailConfig,
  sendPasswordResetEmail
};
