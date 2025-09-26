// emailVerifier.js
const dns = require("dns").promises;
const net = require("net");
const tls = require("tls");
const emailValidator = require("email-validator");
const dotenv = require("dotenv");
dotenv.config();

const SES_HOST = "email-smtp.ap-south-1.amazonaws.com";
const SES_PORT = 587;
const SES_USER = process.env.SES_USER;
const SES_PASS = process.env.SES_PASS;

const disposableDomains = ["mailinator.com", "tempmail.com", "10minutemail.com"];
const roleBasedPrefixes = ["admin@", "info@", "support@", "sales@"];

const base64 = (str) => Buffer.from(str).toString("base64");

function isValidFormat(email) {
  return emailValidator.validate(email);
}

function isDisposableOrRole(email) {
  const domain = email.split("@")[1].toLowerCase();
  return disposableDomains.includes(domain) || roleBasedPrefixes.some(prefix => email.toLowerCase().startsWith(prefix));
}

async function hasMXRecord(email) {
  const domain = email.split("@")[1];
  try {
    const mx = await dns.resolveMx(domain);
    return mx && mx.length > 0;
  } catch {
    return false;
  }
}

function sesCheck(email) {
  return new Promise((resolve) => {
    let stage = 0;
    let buffer = "";
    let socket = net.createConnection(SES_PORT, SES_HOST);

    socket.setTimeout(15000, () => { socket.destroy(); resolve(false); });

    const handleData = (data) => {
      buffer += data.toString();
      const lines = buffer.split("\r\n").filter(Boolean);
      buffer = "";

      for (const line of lines) {
        if (stage === 0 && line.startsWith("220")) { socket.write(`EHLO test.com\r\n`); stage = 1; }
        else if (stage === 1 && line.startsWith("250")) { if (line.includes("STARTTLS")) { socket.write(`STARTTLS\r\n`); stage = 2; } }
        else if (stage === 2 && line.startsWith("220")) {
          socket.removeListener("data", handleData);
          socket = tls.connect({ socket, servername: SES_HOST }, () => {
            socket.on("data", handleData);
            socket.write(`EHLO test.com\r\n`);
            stage = 3;
          });
        }
        else if (stage === 3 && line.startsWith("250")) { socket.write(`AUTH LOGIN\r\n`); stage = 4; }
        else if (stage === 4 && line.startsWith("334")) { socket.write(base64(SES_USER) + "\r\n"); stage = 5; }
        else if (stage === 5 && line.startsWith("334")) { socket.write(base64(SES_PASS) + "\r\n"); stage = 6; }
        else if (stage === 6 && line.startsWith("235")) { socket.write(`MAIL FROM:<verify@yourdomain.com>\r\n`); stage = 7; }
        else if (stage === 7 && line.startsWith("250")) { socket.write(`RCPT TO:<${email}>\r\n`); stage = 8; }
        else if (stage === 8) {
          if (line.startsWith("250")) resolve(true);
          else resolve(false);
          socket.end();
        }
      }
    };

    socket.on("data", handleData);
    socket.on("error", () => resolve(false));
    socket.on("end", () => {});
  });
}

async function verifyEmail2(email) {
  if (!isValidFormat(email)) return false;
  if (isDisposableOrRole(email)) return false;
  if (!(await hasMXRecord(email))) return false;
  return await sesCheck(email);
}

// ------------------------
// Example usage
// ------------------------
// const email = "rainavishfgdf4545al@ov.ai";

// verifyEmail2(email)
//   .then(result => console.log(`Final Result for ${email}:`, result))
//   .catch(err => console.error("Error:", err));


module.exports = { verifyEmail2 };
