const net = require("net");
const tls = require("tls");
const emailValidator = require("email-validator");
const dotenv = require("dotenv");
dotenv.config();

const SES_HOST = "email-smtp.ap-south-1.amazonaws.com";
const SES_PORT = 587;
const SES_USER = process.env.SES_USER;
const SES_PASS = process.env.SES_PASS;

const base64 = (str) => Buffer.from(str).toString("base64");

async function smtpVerify(email) {
  if (!emailValidator.validate(email)) {
    return { email, status: "invalid", reason: "Bad syntax" };
  }

  return new Promise((resolve, reject) => {
    let stage = 0;
    let buffer = "";
    let socket = net.createConnection(SES_PORT, SES_HOST);

    socket.setTimeout(10000, () => {
      reject({ email, status: "unknown", reason: "Timeout" });
      socket.destroy();
    });

    const handleData = (data) => {
      buffer += data.toString();
      const lines = buffer.split("\r\n").filter(Boolean);
      buffer = "";

      for (const line of lines) {
        console.log("SMTP:", line);

        if (stage === 0 && line.startsWith("220")) {
          socket.write(`EHLO test.com\r\n`);
          stage = 1;

        } else if (stage === 1 && line.startsWith("250")) {
          if (line.includes("STARTTLS")) {
            socket.write(`STARTTLS\r\n`);
            stage = 2;
          }

        } else if (stage === 2 && line.startsWith("220")) {
          // Upgrade to TLS
          socket.removeAllListeners("data");
          socket = tls.connect(
            { socket, servername: SES_HOST },
            () => {
              console.log("🔒 TLS established");
              socket.on("data", handleData);
              socket.write(`EHLO test.com\r\n`);
              stage = 3;
            }
          );

        } else if (stage === 3 && line.startsWith("250")) {
          if (line.startsWith("250-")) continue;
          socket.write(`AUTH LOGIN\r\n`);
          stage = 4;

        } else if (stage === 4 && line.startsWith("334")) {
          socket.write(base64(SES_USER) + "\r\n");
          stage = 5;

        } else if (stage === 5 && line.startsWith("334")) {
          socket.write(base64(SES_PASS) + "\r\n");
          stage = 6;

        } else if (stage === 6 && line.startsWith("235")) {
          socket.write(`MAIL FROM:<verify@yourdomain.com>\r\n`);
          stage = 7;

        } else if (stage === 7 && line.startsWith("250")) {
          socket.write(`RCPT TO:<${email}>\r\n`);
          stage = 8;

        } else if (stage === 8) {
          if (line.startsWith("250")) {
            resolve({ email, status: "valid", reason: "Mailbox accepted" });
          } else if (line.startsWith("550")) {
            resolve({ email, status: "invalid", reason: "Mailbox rejected" });
          } else {
            resolve({ email, status: "unknown", reason: line });
          }
          socket.end();
        }
      }
    };

    socket.on("data", handleData);

    socket.on("error", (err) => {
      reject({ email, status: "invalid", reason: err.message });
    });

    socket.on("end", () => {
      // closed
    });
  });
}

//Example usage
// const email = "rainavishgfhrf45546al@ovam.ai"; //"rainavishal@ovam.ai"
// smtpVerify(email)
//   .then((result) => console.log("Result:", result))
//   .catch((err) => console.error("Error:", err));

//accepting all mails which has correct syntax

module.exports = { smtpVerify };
