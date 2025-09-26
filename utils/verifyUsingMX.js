const dns = require("dns").promises;
const net = require("net");

async function verifyUsingMX(email) {
  if (!email) throw new Error("Email is required");

  const domain = email.split("@")[1];
  console.log("Looking up MX for:", domain);

  let addresses;
  try {
    addresses = await dns.resolveMx(domain);
    if (!addresses || addresses.length === 0) throw new Error("No MX records found");
  } catch (err) {
    throw new Error("MX lookup failed: " + err);
  }

  // pick highest priority MX
  const mx = addresses.sort((a, b) => a.priority - b.priority)[0].exchange;
  console.log("Connecting to SMTP server:", mx);

  return new Promise((resolve, reject) => {
    let stage = 0; // 0=greeting, 1=helo, 2=mail from, 3=rcpt to
    const socket = net.createConnection(25, mx);

    socket.on("connect", () => {
      console.log("Connected to SMTP server");
    });

    socket.on("data", (data) => {
      const msg = data.toString();
      console.log("SMTP response:", msg);

      if (stage === 0 && msg.startsWith("220")) {
        socket.write("HELO test.com\r\n");
        stage = 1;

      } else if (stage === 1 && msg.startsWith("250")) {
        socket.write("MAIL FROM:<verify@test.com>\r\n");
        stage = 2;

      } else if (stage === 2 && msg.startsWith("250")) {
        socket.write(`RCPT TO:<${email}>\r\n`);
        stage = 3;

      } else if (stage === 3) {
        if (msg.startsWith("250")) {
          resolve(true);  // mailbox exists
        } else if (msg.startsWith("550")) {
          resolve(false); // mailbox rejected
        } else {
          resolve(null);  // unknown / greylisting
        }
        socket.end();
      }
    });

    socket.on("error", (err) => reject(err));
    socket.on("end", () => console.log("SMTP connection closed"));
  });
}

// Usage
// const email = "vishalraina@ovam.ai"; // non-existent
// verifyUsingMX(email)
//   .then(result => console.log("Result:", result))
//   .catch(err => console.error("Error:", err));

  // We generally do not accept email from dynamic IP's as 
  // they are typically used to deliver unauthenticated SMTP e-mail to an Internet mail server.
  // http://www.spamhaus.org maintains lists of dynamic and residential IP addresses.
   // If you are not an email/network admin please contact your E-mail/Internet Service Provider for help. Email/network admins, please contact <support@zohomail.com> for email delivery information and support