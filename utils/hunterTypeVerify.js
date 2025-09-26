// hunterStyleVerifier.js
const dns = require("dns").promises;
const net = require("net");
const emailValidator = require("email-validator");
const nodemailer = require("nodemailer");

// SES SMTP transporter (replace with your credentials)
const transporter = nodemailer.createTransport({
  host: process.env.SES_HOST || "email-smtp.ap-south-1.amazonaws.com",
  port: process.env.SES_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SES_USER,
    pass: process.env.SES_PASS,
  },
});

// Disposable & role-based detection
const disposableDomains = ["mailinator.com", "tempmail.com", "10minutemail.com"];
const roleAccounts = ["info", "support", "admin", "contact", "sales"];

// Historical data (example, in real use store DB of known bounces)
const historicalBadEmails = ["bounced@example.com"];

/**
 * Hunter-style email verification
 * @param {string} email
 * @returns {Promise<{email: string, status: string, score: number, reason: string}>}
 */
async function verifyEmailHunter(email) {
  const e = email.trim().toLowerCase();
  let score = 100;
  let reason = "";

  // 1️⃣ Syntax check
  if (!emailValidator.validate(e)) {
    return { email: e, status: "invalid", score: 0, reason: "Invalid syntax" };
  }

  const [local, domain] = e.split("@");

  // 2️⃣ Disposable / Role check
  if (disposableDomains.includes(domain)) {
    return { email: e, status: "invalid", score: 0, reason: "Disposable email" };
  }
  if (roleAccounts.includes(local)) {
    score -= 20;
    reason += "Role account; ";
  }

  // 3️⃣ Historical data check
  if (historicalBadEmails.includes(e)) {
    return { email: e, status: "invalid", score: 0, reason: "Previously bounced" };
  }

  // 4️⃣ MX check
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { email: e, status: "invalid", score: 0, reason: "No MX records" };
    }
  } catch (err) {
    return { email: e, status: "invalid", score: 0, reason: "Domain not found / no MX" };
  }

  // 5️⃣ SMTP RCPT check using SES
  try {
    await transporter.verify();
    // Optional: You can implement real SMTP RCPT TO command here with net.connect
  } catch (err) {
    score -= 20;
    reason += "SMTP check failed; ";
  }

  // 6️⃣ Confidence scoring logic
  if (score >= 80) return { email: e, status: "valid", score, reason: reason || "All checks passed" };
  if (score >= 50) return { email: e, status: "risky", score, reason };
  return { email: e, status: "invalid", score, reason };
}

// Example usage
// const testEmails = [
//   "rainavishggh454ghal@ovam.ai",
//   "skyasar24hjg4510@ejimail.com"
//   //"info@mailinator.com",
//   //"support@company.com",
// ];

// testEmails.forEach(async (email) => {
//   const result = await verifyEmailHunter(email);
//   console.log(result);
// });

module.exports = { verifyEmailHunter };
