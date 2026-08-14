const axios = require("axios");
const { log } = require("../../src/util");

/**
 * ZeptoMail (Zoho) transactional email integration.
 *
 * Uses the India data-centre endpoint by default (api.zeptomail.in). All
 * configuration comes from environment variables so no secrets live in the
 * repo:
 *
 *   ZEPTOMAIL_API_TOKEN     - the "Send Mail" token (send-token), required
 *   ZEPTOMAIL_FROM_ADDRESS  - a verified sender on your ZeptoMail domain
 *   ZEPTOMAIL_FROM_NAME     - display name for the sender (optional)
 *   ZEPTOMAIL_API_URL       - override endpoint (optional, defaults to .in)
 *   APP_NAME                - product name used in templates (optional)
 *   APP_URL                 - public base URL used in templates (optional)
 */

const ZEPTOMAIL_API_URL = process.env.ZEPTOMAIL_API_URL || "https://api.zeptomail.in/v1.1/email";
const FROM_ADDRESS = process.env.ZEPTOMAIL_FROM_ADDRESS || "";
const FROM_NAME = process.env.ZEPTOMAIL_FROM_NAME || process.env.APP_NAME || "PulseGuard";
const APP_NAME = process.env.APP_NAME || "PulseGuard";
const APP_URL = process.env.APP_URL || "https://pg.bytenex.io";

/**
 * Is the email integration configured well enough to actually send?
 * @returns {boolean} True if a token and sender address are present.
 */
function isEmailConfigured() {
    return Boolean(process.env.ZEPTOMAIL_API_TOKEN && FROM_ADDRESS);
}

/**
 * Low-level send. Posts a single email to the ZeptoMail REST API.
 * @param {object} params Email params.
 * @param {string} params.toAddress Recipient email address.
 * @param {string} params.subject Subject line.
 * @param {string} params.htmlBody Rendered HTML body.
 * @param {string} [params.toName] Recipient display name.
 * @returns {Promise<void>}
 * @throws {Error} If not configured or the API rejects the request.
 */
async function sendMail({ toAddress, subject, htmlBody, toName }) {
    if (!isEmailConfigured()) {
        throw new Error("Email is not configured (missing ZEPTOMAIL_API_TOKEN or ZEPTOMAIL_FROM_ADDRESS)");
    }

    const payload = {
        from: {
            address: FROM_ADDRESS,
            name: FROM_NAME,
        },
        to: [
            {
                email_address: {
                    address: toAddress,
                    name: toName || toAddress,
                },
            },
        ],
        subject,
        htmlbody: htmlBody,
    };

    try {
        await axios.post(ZEPTOMAIL_API_URL, payload, {
            headers: {
                // ZeptoMail expects the raw send-token value prefixed with this scheme.
                "Authorization": `Zoho-enczapikey ${process.env.ZEPTOMAIL_API_TOKEN}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout: 15000,
        });
        log.info("email", `Sent "${subject}" to ${toAddress}`);
    } catch (error) {
        // Do not leak the token; surface only the API's own message.
        const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        log.error("email", `Failed to send to ${toAddress}: ${detail}`);
        throw new Error("Failed to send email");
    }
}

/**
 * Shared responsive HTML shell for all transactional emails.
 * @param {object} params Template params.
 * @param {string} params.title Preheader / heading text.
 * @param {string} params.bodyHtml Inner HTML content.
 * @returns {string} Full HTML document.
 */
function baseTemplate({ title, bodyHtml }) {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(2,6,23,.5);">
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#0ea5e9);padding:28px 32px;">
              <span style="display:inline-block;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:.3px;">
                ${escapeHtml(APP_NAME)}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                You received this email because an action was requested for your
                ${escapeHtml(APP_NAME)} account. If this wasn't you, you can safely ignore it.<br>
                &copy; ${year} ${escapeHtml(APP_NAME)} &middot; <a href="${escapeAttr(APP_URL)}" style="color:#6366f1;text-decoration:none;">${escapeHtml(stripProtocol(APP_URL))}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build the one-time-code email body.
 * @param {object} params Template params.
 * @param {string} params.code The 6-digit OTP.
 * @param {string} params.purpose "login" or "register".
 * @param {number} params.expiresMinutes Minutes until the code expires.
 * @returns {string} Full HTML document.
 */
function otpEmailTemplate({ code, purpose, expiresMinutes }) {
    const heading = purpose === "register" ? "Confirm your email" : "Your sign-in code";
    const intro = purpose === "register"
        ? `Welcome to ${escapeHtml(APP_NAME)}! Enter the code below to verify your email and finish creating your account.`
        : `Use the code below to sign in to your ${escapeHtml(APP_NAME)} account.`;

    const bodyHtml = `
      <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">${heading}</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">${intro}</p>
      <div style="text-align:center;margin:0 0 24px;">
        <div style="display:inline-block;padding:16px 28px;background:#f1f5f9;border:1px dashed #cbd5e1;border-radius:12px;font-size:34px;font-weight:700;letter-spacing:10px;color:#0f172a;">
          ${escapeHtml(code)}
        </div>
      </div>
      <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
        This code expires in ${escapeHtml(String(expiresMinutes))} minutes and can be used once.
        Never share it with anyone &mdash; ${escapeHtml(APP_NAME)} staff will never ask for it.
      </p>`;

    return baseTemplate({ title: heading, bodyHtml });
}

/**
 * Send an OTP code email.
 * @param {object} params Params.
 * @param {string} params.toAddress Recipient email.
 * @param {string} params.code The one-time code.
 * @param {string} params.purpose "login" or "register".
 * @param {number} params.expiresMinutes Minutes until expiry.
 * @returns {Promise<void>}
 */
async function sendOtpEmail({ toAddress, code, purpose, expiresMinutes }) {
    const subject = purpose === "register"
        ? `${APP_NAME}: confirm your email (${code})`
        : `${APP_NAME}: your sign-in code (${code})`;
    const htmlBody = otpEmailTemplate({ code, purpose, expiresMinutes });
    await sendMail({ toAddress, subject, htmlBody });
}

/**
 * Escape a string for safe insertion into HTML text nodes.
 * @param {string} value Raw string.
 * @returns {string} Escaped string.
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Escape a string for safe insertion into an HTML attribute.
 * @param {string} value Raw string.
 * @returns {string} Escaped string.
 */
function escapeAttr(value) {
    return escapeHtml(value);
}

/**
 * Strip the protocol from a URL for display.
 * @param {string} url URL.
 * @returns {string} URL without protocol.
 */
function stripProtocol(url) {
    return String(url).replace(/^https?:\/\//, "");
}

module.exports = {
    isEmailConfigured,
    sendMail,
    sendOtpEmail,
    otpEmailTemplate,
};
