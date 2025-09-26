const dns = require("dns").promises;
const net = require("net");
const emailValidator = require("email-validator");
// const pLimit = require("p-limit");

const pLimit = require("p-limit");

const CONCURRENCY = 5;
const limit = pLimit(CONCURRENCY);

const RETRIES = 2;
const RETRY_DELAY = 4000;

// Disposable & role-based
const disposableDomains = ["mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com"];
const roleBased = ["admin", "support", "info", "sales", "contact", "billing", "security"];
const mxCache = new Map();
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function smtpCheck(domain, email, attempt = 0) {
  try {
    let mxRecords = mxCache.get(domain) || await dns.resolveMx(domain);
    if (!mxCache.has(domain)) {
      mxRecords.sort((a, b) => a.priority - b.priority);
      mxCache.set(domain, mxRecords);
    }

    if (!mxRecords || mxRecords.length === 0) return { success: false, reason: "No MX records" };

    const mx = mxRecords[0].exchange;

    return new Promise((resolve) => {
      const socket = net.createConnection(25, mx);
      let stage = 0;
      socket.setTimeout(5000);

      socket.on("data", (data) => {
        const msg = data.toString();
        if (stage === 0 && msg.startsWith("220")) { socket.write("HELO test.com\r\n"); stage++; }
        else if (stage === 1 && msg.startsWith("250")) { socket.write("MAIL FROM:<check@test.com>\r\n"); stage++; }
        else if (stage === 2 && msg.startsWith("250")) { socket.write(`RCPT TO:<${email}>\r\n`); stage++; }
        else if (stage === 3) {
          if (/250/.test(msg)) {
            resolve({ success: true, reason: "Accepted" }); // valid
          } 
          else if (/252/.test(msg)) {
            resolve({ success: true, reason: "Server cannot verify but accepts (catch-all)" });
          } 
          else if (/550/.test(msg)) {
            if (["zoho.in", "zoho.com"].includes(domain)) {
              resolve({ success: false, reason: "Zoho blocks verification (mailbox may exist)" });
            } else {
              resolve({ success: false, reason: "Invalid mailbox" });
            }
          }
          else if (/451|421/.test(msg) && attempt < RETRIES) {
            socket.end();
            delay(RETRY_DELAY).then(async () => 
              resolve(await smtpCheck(domain, email, attempt + 1))
            );
            return;
          } 
          else {
            resolve({ success: false, reason: "Uncertain / anti-spam filter" });
          }
          socket.end();
        }        
        
      });

      socket.on("error", () => resolve({ success: false, reason: "SMTP error" }));
      socket.on("timeout", () => { socket.destroy(); resolve({ success: false, reason: "Timeout" }); });
    });
  } catch {
    return { success: false, reason: "DNS/MX lookup failed" };
  }
}

async function verifyEmail(email) {
  if (!emailValidator.validate(email)) 
    return { email, status: "invalid", reason: "Bad syntax" };

  const [localPart, domain] = email.split("@");

  if (roleBased.includes(localPart.toLowerCase())) 
    return { email, status: "risky", reason: "Role-based" };

  if (disposableDomains.includes(domain.toLowerCase())) 
    return { email, status: "invalid", reason: "Disposable domain" };

  try {
    let mxRecords = mxCache.get(domain) || await dns.resolveMx(domain);
    if (!mxCache.has(domain)) { 
      mxRecords.sort((a,b)=>a.priority-b.priority); 
      mxCache.set(domain, mxRecords); 
    }
    if (!mxRecords || mxRecords.length === 0) 
      return { email, status: "invalid", reason: "No MX records" };
  } catch {
    return { email, status: "invalid", reason: "DNS failed" };
  }

  const smtpResult = await smtpCheck(domain, email);

  // ✅ classify result properly
  if (smtpResult.success) {
    return { email, status: "valid", reason: smtpResult.reason };
  }

  if (smtpResult.reason.includes("Zoho blocks verification")) {
    return { email, status: "risky", reason: smtpResult.reason };
  }

  if (smtpResult.reason.includes("catch-all")) {
    return { email, status: "risky", reason: smtpResult.reason };
  }

  return { email, status: "invalid", reason: smtpResult.reason };
}

// const email = "rainavishal@ovam.ai";
// verifyEmail(email)
//   .then(result => console.log("Result:", result))
//   .catch(err => console.error("Error:", err));
module.exports = { verifyEmail };
