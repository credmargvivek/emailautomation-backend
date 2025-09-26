const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();
const axios = require('axios');
const { verifyEmailHunter } = require("./hunterTypeVerify");
const { verifyEmail } = require("./verifyEmail");

// Load your service account JSON (path in .env)
// const key = require(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);


// const sendEmail = async (to, subject, body, from) => {
//   try {
//     // 1️⃣ Verify email using Hunter
//     const verification = await verifyEmailHunter(to);
//     if (verification.status !== "valid") {
//       console.log(`❌ Email is invalid: ${to} | Reason: ${verification.reason}`);
//       return { success: false, message: `Email is invalid: ${verification.reason}` };
//     }

//     // 2️⃣ Prepare Postmark request
//     const postmarkData = {
//       From: from,
//       To: to,
//       Subject: subject,
//       TextBody: body,
//       // HtmlBody: `<html><body>${body}</body></html>`, // Optional HTML
//       MessageStream: "outbound"
//     };

//     // 3️⃣ Send via Postmark API
//     const response = await axios.post(
//       'https://api.postmarkapp.com/email',
//       postmarkData,
//       {
//         headers: {
//           'Accept': 'application/json',
//           'Content-Type': 'application/json',
//           'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN
//         }
//       }
//     );

//     console.log("✅ Postmark email sent:", to, response.data.MessageID);
//     return { success: true, result: response.data };

//   } catch (error) {
//     console.error("❌ Postmark email failed:", error.response?.data || error.message);
//     process.exit(1);
//     return { 
//       success: false, 
//       message: error.response?.data?.Message || error.message || "Postmark email sending failed" 
//     };
//   }
// };

// module.exports = { sendEmail };

//###############################################################################################################3

const key = {
  type: "service_account",
  project_id: "myproject01-473106",
  private_key_id: "d14ea6789e40b91cf6abaa6da6709d59364c4377",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCumEM4C6JlslAv\nUfQRMrZ3KQagoKdnTwh4Jx/QwUGH1C33/ilqTHjtRJ7WRRmtTDvj98c0RwJOPQo4\nL8Tah/Nr9e8eUsExAQ8aYPMLdXVBJR4UBolrM7AjOHwMlXLdKMGKpS5kCRqpOnys\nY4PEokF7VuXiAho7rWqmFKK9ZBI4EDXi2zBsRD5QoCr5Q+QV9FXoRlmGMt3fDFg8\nPjHY/jRcXlj3x9lRMdMCRWasTCgqvEKP85mmPPHJ/rAlhKlU/Sno4N11siq4p2aI\nZfTKd+JEN/qfMfB0juTAjLtqJqs+My0RDsvW+G3l4J2TfWewID5M2rW5FgPEhUla\nf8AyeMhnAgMBAAECggEARjNku7E53+gdg5lRKGUaprjxOD7AcLJ/dkhM65P49FNl\nFFS2dE5BRS2VLBRmqZ6Aaj4jc6qli63RYRwb675EKwGc3rVphnmlh/a5Yr8coU/6\nUxT5xgfnZ5H7lte0cqZDg6q9B239sVOZ83qj7blL2Prsvb4YrCwjOJoNgVcuWCnK\nacsvFpTe9ILHFe3xxtSOUlEMHG9rs/IR/3nTi9zjg2HPm8/cMXdjsq9jjKtJezM/\nPyhwRqktZpVvXPThfBJdi/0eBWFsqyoayrtx4GIDs4tN03QdqsaQzh52NGxJ5ONm\nxddKcnuPiiWjmk+Q6hLgZVk+WozuHJYgZWnXQ1UNAQKBgQDWMmj5qOMWu6lfarDu\nS5KVVaWF8QYKFYu8jgZTcMk9lDtfWvZ+4wGheLdzAL8D5kJo95aaFT7mYHBMNGEM\n6KY2qOR6WIB7cse2oODBGgt+snNqPb08Nbji+IThrrHvndTtTHSyxwewch2nCfO0\nKYjTDAOBHfv7vY7y9xgDD+84gQKBgQDQq0WfirFgOfJg9QI9FNgW1WBdAaXMEeGf\nZ+IiOIV87IQihq61obYBn0k+vMSVbswSywyrozQeIDCrmJMlCTgM7FpK0lrnqa2d\nzpHkvKzRaVf5z2uogsLQbqZqZkKmJRT43ZQe0NToBrMA88URRPCFOCO2yfRSLUGo\ndJQ8lZbM5wKBgDp6ILaoKPc33JG0KwGjmC006K+cka2HHFMp4wg8rnQlV+A8kTcq\n+nL+5fZ7qaqC3naRwYfnbPiwM3hahHRlv5sEmPvd1ZXeTC/L1BBj7+dzCJdkq5kY\ngZVVi9GhQ+rLCCqQyPtV4v+E6BuGWAZDoJsdmIdTjEu6AKDMXL3ZR9IBAoGAECvl\n1mpyOqni/d6fEMrHwGVC9ZJGHh2YpbjwToSg28CcsOxNJ+hjaZbFn2YTuhz/FcnE\nrpyUUm1eOD430Rv4yw+aI8hPoTqGKP+0UMzKe+Q1HDgV+NZBcNPSc9Z+/c9L48mQ\nTB8VEPJL9xvtPtxf44MpSWY3WBMHzp1SS6uwJysCgYBakJLT/meFTTeB/yAT1Nxz\niYyLM5BFeNGuj2MqFEBBRLotg5olowqOUavXOIQEw3wvupkDEF3fVpELud+r0JPu\nCxntR8vvBlWBdcmnKtKpbpJrUOe/k5BZF8Lp4Zj/Y2hqz334ACzu7d4K7bGngxiI\nVf33CB35c2dxO6KS1LP4wQ==\n-----END PRIVATE KEY-----\n",
  client_email: "abcd12@myproject01-473106.iam.gserviceaccount.com",
  client_id: "104402427935134396647",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/abcd12%40myproject01-473106.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
}

const sendEmail = async (to, subject, body, from) => {
  try {
    // 1️⃣ Verify email using Hunter
    const verification = await verifyEmailHunter(to);
    if (verification.status !== "valid") {
      console.log(`❌ Email is invalid: ${to} | Reason: ${verification.reason}`);
      return { success: false, message: `Email is invalid: ${verification.reason}` };
    }

    // 2️⃣ Create JWT client for domain-wide delegation
    const jwtClient = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ["https://www.googleapis.com/auth/gmail.send"],
      subject: from
    });

    // 3️⃣ Authorize
    await jwtClient.authorize();

    // 4️⃣ Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: jwtClient });

    // 5️⃣ Create email message
    const rawMessage = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      body
    ].join('\n');

    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 6️⃣ Send email via Gmail API
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    });
    
    console.log("✅ Email sent:", to, result.data.id);
    return { success: true, result: result.data };
   
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    return { success: false, message: error.message || "Email sending failed" };
  }
};

// const sendEmail = async (to, subject, body, from) => {
//   try {
//     // 1️⃣ Verify email using Hunter
//     const verification = await verifyEmailHunter(to);
//     if (verification.status !== "valid") {
//       console.log(`❌ Email is invalid: ${to} | Reason: ${verification.reason}`);
//       return { success: false, message: `Email is invalid: ${verification.reason}` };
//     }

//     // 2️⃣ Create JWT client for domain-wide delegation
//     const jwtClient = new google.auth.JWT({
//      email: key.client_email,
//      key: key.private_key,
//      scopes: ["https://www.googleapis.com/auth/gmail.send"],
//      subject: from  // for domain-wide delegation
//   });

//     // 3️⃣ Authorize and get access token
//     const tokens = await jwtClient.authorize();

//     // 4️⃣ Create Nodemailer transporter using Gmail API
//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         type: "OAuth2",
//         user: from,
//         accessToken: tokens.access_token,
//       },
//     });

//     // 5️⃣ Prepare email options
//     const mailOptions = {
//       from,
//       to,
//       subject,
//       text: body,
//       // html: `<html><body>${body}</body></html>` // optional HTML
//     };

//     // 6️⃣ Send email
//     const info = await transporter.sendMail(mailOptions);
//     console.log("✅ Email sent:", to, info.messageId);

//     return { success: true, result: info };
//   } catch (error) {
//     console.error("❌ Email sending failed:", error);
//     process.exit(1);
//     return { success: false, message: error.message || "Email sending failed" };
//   }
// };

module.exports = { sendEmail };

//############################################################################333


// const { EmailClient } = require("@azure/communication-email");
// const dotenv = require("dotenv");
// dotenv.config();

// const { verifyEmailHunter } = require("./hunterTypeVerify");
// const { verifyEmail } = require("./verifyEmail");

// // Initialize Azure Communication Services Email client
// const emailClient = new EmailClient(process.env.AZURE_COMMUNICATION_CONNECTION_STRING);

// const sendEmail = async (to, subject, body, from) => {
//   try {
//     // Verify email using Hunter (keeping your existing verification)
//     const verification = await verifyEmailHunter(to);
//     if (verification.status !== "valid") {
//       console.log(`❌ Email is invalid: ${to} | Reason: ${verification.reason}`);
//       return { success: false, message: `Email is invalid: ${verification.reason}` };
//     }

//     // Prepare email message for Azure
//     const emailMessage = {
//       // senderAddress: "donotreply@e9287797-cf4a-47d5-9d56-e80eecad54eb.azurecomm.net", 
//       senderAddress: "kay@ovam.dev", 
//       content: {
//         subject: subject,
//         plainText: body,
//         // Optionally add HTML content:
//         // html: `<html><body>${body}</body></html>`
//       },
//       recipients: {
//         to: [
//           {
//             address: to,
//           }
//         ]
//       }
//     };

//     // Send email using Azure Communication Services
//     const poller = await emailClient.beginSend(emailMessage);
//     const result = await poller.pollUntilDone();

//     console.log("✅ Email sent:", to, result.id);
//     return { success: true, result: result };

//   } catch (error) {
//     console.error("❌ Email sending failed:", error);
//     process.exit(1); 
//     return { 
//       success: false, 
//       message: error.message || "Email sending failed",
//     };
//   }
// };

// module.exports = { sendEmail };


// #########################################################################################################


// const AWS = require("aws-sdk");
// const dotenv = require("dotenv");
// dotenv.config();
// AWS.config.update({ region: "ap-south-1" });
// const { verifyEmailHunter } = require("./hunterTypeVerify");
// const { verifyEmail } = require("./verifyEmail"); // <-- import here
// //const {guessEmailPattern} = require("./utils/aiemailExtractor");

// const ses = new AWS.SES({
//   accessKeyId: process.env.AWS_ACCESS_KEY,
//   secretAccessKey: process.env.AWS_SECRET_KEY,
// });

// const sendEmail = async (to, subject, body, from) => {
//   try {
//     const verification = await verifyEmailHunter(to);
//     if (verification.status !== "valid") {
//       console.log(`❌ Email is invalid: ${to} | Reason: ${verification.reason}`);
//       return { success: false, message: `Email is invalid: ${verification.reason}` };
//     }
    
//     const params = {
//       Source: from, // "kris@ovam.dev"
//       Destination: { ToAddresses: [to] },
//       Message: {
//         Subject: { Data: subject },
//         Body: { Text: { Data: body } },
//       },
//     };

//     const result = await ses.sendEmail(params).promise();
//     console.log("✅ Email sent:", to,  result.MessageId);
//     return { success: true, result };
//   } catch (error) {
//     console.error("❌ Email sending failed:", error);
//     return { success: false, message: error.message || "Email sending failed", };
//   }
// };

// module.exports = { sendEmail };
