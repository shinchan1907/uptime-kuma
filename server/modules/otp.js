const crypto = require("crypto");
const dayjs = require("dayjs");
const { R } = require("redbean-node");
const passwordHash = require("../password-hash");
const { log } = require("../../src/util");

/**
 * Email OTP (one-time code) issuing and verification.
 *
 * Codes are numeric, stored only as a bcrypt hash, single-use, expiring, and
 * rate-limited on both issue (resend cooldown) and verify (attempt cap).
 */

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * The datetime format redbean/SQLite store expects.
 * @returns {string} Current UTC timestamp.
 */
function now() {
    return R.isoDateTime(dayjs.utc());
}

/**
 * Generate a cryptographically-random numeric code.
 * @returns {string} A zero-padded numeric string of length OTP_LENGTH.
 */
function generateCode() {
    const max = 10 ** OTP_LENGTH;
    return String(crypto.randomInt(0, max)).padStart(OTP_LENGTH, "0");
}

/**
 * Issue a new OTP for an email + purpose. Invalidates prior unconsumed codes
 * for the same email/purpose and enforces a resend cooldown.
 * @param {string} email Normalised (lowercased) email address.
 * @param {string} purpose "login" or "register".
 * @returns {Promise<{code: string, expiresMinutes: number}>} The raw code (to email) + expiry.
 * @throws {Error} If a code was requested too recently (cooldown).
 */
async function issueOtp(email, purpose) {
    const recent = await R.findOne(
        "email_otp",
        " email = ? AND purpose = ? ORDER BY id DESC ",
        [ email, purpose ]
    );

    if (recent) {
        const secondsSince = dayjs.utc().diff(dayjs.utc(recent.created_date), "second");
        if (secondsSince < RESEND_COOLDOWN_SECONDS) {
            const wait = RESEND_COOLDOWN_SECONDS - secondsSince;
            const err = new Error(`Please wait ${wait}s before requesting another code`);
            err.code = "OTP_COOLDOWN";
            throw err;
        }
    }

    // Invalidate any still-valid prior codes for this email/purpose.
    await R.exec(
        "UPDATE email_otp SET consumed = 1 WHERE email = ? AND purpose = ? AND consumed = 0",
        [ email, purpose ]
    );

    const code = generateCode();
    const bean = R.dispense("email_otp");
    bean.email = email;
    bean.code_hash = await passwordHash.generate(code);
    bean.purpose = purpose;
    bean.expires = R.isoDateTime(dayjs.utc().add(OTP_EXPIRY_MINUTES, "minute"));
    bean.consumed = false;
    bean.attempts = 0;
    bean.created_date = now();
    await R.store(bean);

    log.info("otp", `Issued ${purpose} code for ${email}`);
    return { code, expiresMinutes: OTP_EXPIRY_MINUTES };
}

/**
 * Verify a submitted code against the latest outstanding OTP.
 * On success the code is marked consumed. On failure the attempt is counted
 * and the code is invalidated once attempts exceed the cap.
 * @param {string} email Normalised (lowercased) email address.
 * @param {string} purpose "login" or "register".
 * @param {string} code The code the user submitted.
 * @returns {Promise<boolean>} True if the code is valid.
 */
async function verifyOtp(email, purpose, code) {
    if (typeof code !== "string" || !/^\d+$/.test(code)) {
        return false;
    }

    const bean = await R.findOne(
        "email_otp",
        " email = ? AND purpose = ? AND consumed = 0 ORDER BY id DESC ",
        [ email, purpose ]
    );

    if (!bean) {
        return false;
    }

    if (dayjs.utc().isAfter(dayjs.utc(bean.expires))) {
        bean.consumed = true;
        await R.store(bean);
        return false;
    }

    if (bean.attempts >= MAX_VERIFY_ATTEMPTS) {
        bean.consumed = true;
        await R.store(bean);
        return false;
    }

    const ok = passwordHash.verify(code, bean.code_hash);
    if (ok) {
        bean.consumed = true;
        await R.store(bean);
        return true;
    }

    bean.attempts += 1;
    if (bean.attempts >= MAX_VERIFY_ATTEMPTS) {
        bean.consumed = true;
    }
    await R.store(bean);
    return false;
}

module.exports = {
    issueOtp,
    verifyOtp,
    OTP_EXPIRY_MINUTES,
    RESEND_COOLDOWN_SECONDS,
};
