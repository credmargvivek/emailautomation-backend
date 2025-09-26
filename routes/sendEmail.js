const express = require('express');
const Campaign = require('../models/Campaign');
const { verifyEmailHunter } = require('../utils/hunterTypeVerify');
const { sendEmail } = require('../utils/nodeMailer');
const authMiddleware = require('../middlewares/authMiddleware');
const OpenAI = require('openai');

const router = express.Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Make sure to set this in your environment
});

// Combined function to generate both subject line and email body
async function generateEmailContent(companyData) {
  const contactName = companyData.fullName || companyData.firstName || 'Team';
  
  const prompt = `You are an expert at writing compelling B2B SaaS outreach emails.

Given a company's data, do the following:
- Research the company online (industry, website, products/services, recent news).
- Determine if the company is tech or non-tech.
- Generate both a subject line and email body that work together perfectly.

SUBJECT LINE Requirements:
- References the company or recent update. If you are referencing just use the name (e.g., "Reuters") instead of a link.
- Includes a specific, tangible number (e.g., hours saved, % efficiency gain, $ saved)
- Concise, attention-grabbing, makes the reader want to open the email

EMAIL BODY Requirements (under 120 words):
- Opens with something specific about the company or contact
- Mentions a likely pain point relevant to their industry/scale
- Explains how OVAM SaaS can help:
  • Tech companies: AI-based code review, QA automation, security scans
  • Non-tech companies: Custom AI tools, searchable database solutions, workflow automation
- Highlights tangible benefits like saving time, reducing costs, or increasing efficiency
- Feels friendly and not salesy
- Ends with a soft CTA to chat

Company data:
Company name: ${companyData.companyName}
Website: ${companyData.domain ? `https://${companyData.domain}` : 'Not available'}
Industry: Determine from company name and domain
Recent news/update: Research if possible

IMPORTANT: Format your response should be a string strictly be like "SUBJECT: || BODY: ". Don't include anything uneccessary. For example: 
SUBJECT: [Your subject line here]
||
BODY: Hi ${contactName}, //don't modify this word ${contactName} after Hi

[Personalized intro referencing company & update and do not use link].

[One sentence about a likely pain point].

[One sentence explaining how OVAM solves it and the tangible benefit].

Would you be open to a quick chat?

Best,
Ovamai`;

  console.log('Combined email generation prompt ---> ', prompt);

  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      tools: [
        { type: "web_search" },
      ],
      input: prompt,
    });
    
    const content = response.output_text;
    
    console.log('content--->', content);

    // Split the response to get subject and body
    const parts = content.split('||');
    
    if (parts.length !== 2) {
      throw new Error('Invalid response format from OpenAI');
    }
    
    const subject = parts[0].replace('SUBJECT:', '').trim();
    const body = parts[1].replace('BODY:', '').trim();
    
    return { subject, body };
    
  } catch (error) {
    console.error('Error generating email content:', error);
    throw error;
  }
}

// Updated router with combined generation
router.post("/send-mail", async (req, res) => {
  try {
    const { userId, campaignId, subject, body, fromEmail = 'kay@ovam.dev' } = req.body;
    
    console.log('req.body--> ', req.body);
    
    // Validation
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }
    
    if (!campaignId) {
      return res.status(400).json({ success: false, message: "Campaign ID required" });
    }

    // Fetch campaign based on campaignId and userId (for security)
    const campaign = await Campaign.findOne({ 
      _id: campaignId, 
      owner: userId 
    }).lean();

    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        message: "Campaign not found or you don't have access to it" 
      });
    }

    // Extract valid contacts from campaign data
    const contacts = campaign.data
      .filter(contact => contact.email && contact.email.trim() !== '')
      .map(contact => ({
        ...contact,
        email: contact.email.trim().toLowerCase()
      }));
    
    console.log('contacts---> ', contacts);
    console.log('contacts: ', contacts.length);

    if (contacts.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "No valid contacts found in the campaign" 
      });
    }

    console.log(`📧 Found ${contacts.length} contacts to process`);

    // Results tracking
    const results = {
      total: contacts.length,
      sent: 0,
      failed: 0,
      invalid: 0,
      details: []
    };

    for (const contact of contacts) {
      try {
        console.log(`🔍 Processing: ${contact.email}`);
        
        // Verify email first
        const verification = await verifyEmailHunter(contact.email);
        
        if (verification.status === 'valid') {
          // Email is valid - mark as verified immediately
          await Campaign.updateOne(
            { _id: campaignId, 'data.email': contact.email },
            { $set: { 'data.$.isVerified': true } }
          );
          
          let emailSubject = subject;
          let emailBody = body;
          
          // Generate personalized content if not provided
          if (!subject || !body) {
            console.log(`🤖 Generating personalized content for ${contact.companyName || contact.email}`);
            
            try {
              const generatedContent = await generateEmailContent(contact);
              
              if (!subject) {
                emailSubject = generatedContent.subject;
                console.log(`📝 Generated subject: ${emailSubject}`);
              }
              
              if (!body) {
                emailBody = generatedContent.body;
                console.log(`📝 Generated body length: ${emailBody.length} characters`);
              }
            } catch (generationError) {
              console.error('Error generating email content:', generationError);
              results.failed++;
              results.details.push({
                email: contact.email,
                status: 'failed',
                message: 'Could not generate email content',
                verificationScore: verification.score,
                isVerified: true
              });
              continue;
            }
          }
          
          // Validate that we have subject and body now
          if (!emailSubject || !emailBody) {
            results.failed++;
            results.details.push({
              email: contact.email,
              status: 'failed',
              message: 'Could not generate email content',
              verificationScore: verification.score,
              isVerified: true
            });
            continue;
          }
          
          // Attempt to send email with personalized content
          const sendResult = await sendEmail(contact.email, emailSubject, emailBody, fromEmail);
          
          if (sendResult.success) {
            results.sent++;
            results.details.push({
              email: contact.email,
              companyName: contact.companyName,
              contactName: contact.fullName || contact.firstName,
              status: 'sent',
              message: 'Email sent successfully',
              verificationScore: verification.score,
              isVerified: true,
              generatedSubject: !subject ? emailSubject : undefined,
              generatedBody: !body ? emailBody.substring(0, 100) + '...' : undefined
            });
          } else {
            results.failed++;
            results.details.push({
              email: contact.email,
              companyName: contact.companyName,
              contactName: contact.fullName || contact.firstName,
              status: 'failed',
              message: sendResult.message,
              verificationScore: verification.score,
              isVerified: true
            });
          }
        } else {
          // Email is invalid or risky
          results.invalid++;
          results.details.push({
            email: contact.email,
            companyName: contact.companyName,
            contactName: contact.fullName || contact.firstName,
            status: 'invalid',
            message: verification.reason,
            verificationScore: verification.score
          });
        }
        
        // Delay between emails (10 seconds + OpenAI API call time)
        await new Promise(resolve => setTimeout(resolve, 10000));
        
      } catch (error) {
        console.error(`❌ Error processing ${contact.email}:`, error);
        results.failed++;
        results.details.push({
          email: contact.email,
          companyName: contact.companyName,
          contactName: contact.fullName || contact.firstName,
          status: 'error',
          message: error.message || 'Unknown error occurred'
        });
      }
    }

    // Send response with results
    res.json({ 
      success: true, 
      message: `Email campaign completed. Sent: ${results.sent}, Failed: ${results.failed}, Invalid: ${results.invalid}`,
      campaign: {
        id: campaign._id,
        name: campaign.name
      },
      personalization: {
        subjectGenerated: !subject,
        bodyGenerated: !body
      },
      results: results
    });

  } catch (err) {
    console.error("Error in send-mail route:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: err.message 
    });
  }
});

module.exports = router;



// // Function to generate subject line using OpenAI
// async function generateSubjectLine(companyData) {
//   const prompt = `You are an expert at writing one highly compelling, value-driven email subject line for B2B SaaS outreach.

// Given a company's data, do the following:
// - Research the company online (industry, website, products/services, recent news).
// - Determine if the company is tech or non-tech.
// - Generate one subject line that:
//     References the company or recent update
//     Includes a specific, tangible number (e.g., hours saved, % efficiency gain, $ saved) to immediately show value
//     Is concise, attention-grabbing, and makes the reader want to open the email

// Company data:
// Company name: ${companyData.companyName || companyData.email}
// Website: ${`https://${companyData.domain}`}
// Industry: Determine from company name and domain
// Recent news/update: Research if possible

// Output format:
// [Subject line only - no additional text]`;

// console.log('subject line prompt ---> ',prompt)

//   try {
//     // const response = await openai.chat.completions.create({
//     //   model: "gpt-4o-mini",
//     //   messages: [{ role: "user", content: prompt }],
//     //   max_tokens: 100,
//     //   temperature: 0.7
//     // });
//     // return response.choices[0].message.content.trim();
//     const response = await openai.responses.create({
//     model: "gpt-4o-mini",
//     tools: [
//       { type: "web_search" },
//     ],
//     input: prompt,
//     });
//     return response.output_text;
    
//   } catch (error) {
//     console.error('Error generating subject line:', error);
    
//   }
// }

// // Function to generate email body using OpenAI
// async function generateEmailBody(companyData, subjectLine) {
//   const contactName = companyData.fullName || companyData.firstName || 'Team';
  
//   const prompt = `You are an expert at writing concise, personalized B2B outreach emails for SaaS.

// Given a company's data and a high-impact subject line, do the following:
// - Research the company online (industry, website, products/services, recent news).
// - Determine if the company is tech or non-tech.
// - Write a short email (under 120 words) that:
//     Opens with something specific about the company or contact
//     Mentions a likely pain point relevant to their industry/scale
//     Explains how OVAM can help:
//     • Tech companies: AI-based code review, QA automation, security scans
//     • Non-tech companies: Custom AI tools, searchable database solutions, workflow automation
//     Highlights tangible benefits like saving time, reducing costs, or increasing efficiency
//     Feels friendly and not salesy
//     Ends with a soft CTA to chat

// Company data:
// Company name: ${companyData.companyName || companyData.email}
// Website: ${`https://${companyData.domain}`}
// Industry: Determine from company name and domain
// Recent news/update: Research if possible
// Selected subject line: ${subjectLine}

// Output format:
// Hi ${companyData.fullName || companyData.firstName || companyData.lastName},

// [Personalized intro referencing company & update].

// [One sentence about a likely pain point].

// [One sentence explaining how OVAM solves it and the tangible benefit].

// Would you be open to a quick chat?

// Best,
// Ovamai `;

// console.log('Email body prompt ---->', prompt)

//   try {
//     // const response = await openai.chat.completions.create({
//     //   model: "gpt-4o-mini",
//     //   messages: [{ role: "user", content: prompt }],
//     //   max_tokens: 200,
//     //   temperature: 0.7
//     // });
//     // return response.choices[0].message.content.trim();
    
//     const response = await openai.responses.create({
//     model: "gpt-4o-mini",
//     tools: [
//       { type: "web_search" },
//     ],
//     input: prompt,
//     });
//     return response.output_text;
//   } catch (error) {
//     console.error('Error generating email body:', error);
//   }
// }



// router.post("/send-mail", async (req, res) => {
//   try {
//     const { userId, campaignId, subject, body, fromEmail = 'kris@ovam.dev' } = req.body;

//     console.log('req.body--> ', req.body);
    
//     // Validation
//     if (!userId) {
//       return res.status(400).json({ success: false, message: "User ID required" });
//     }
    
//     if (!campaignId) {
//       return res.status(400).json({ success: false, message: "Campaign ID required" });
//     }

//     // Fetch campaign based on campaignId and userId (for security)
//     const campaign = await Campaign.findOne({ 
//       _id: campaignId, 
//       owner: userId 
//     }).lean();

//     if (!campaign) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Campaign not found or you don't have access to it" 
//       });
//     }

//     // Extract valid contacts from campaign data
//     const contacts = campaign.data
//       .filter(contact => contact.email && contact.email.trim() !== '')
//       .map(contact => ({
//         ...contact,
//         email: contact.email.trim().toLowerCase()
//       }));
    
//     console.log('contacts---> ',contacts)

//     console.log('contacts: ', contacts.length);

//     if (contacts.length === 0) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "No valid contacts found in the campaign" 
//       });
//     }

//     console.log(`📧 Found ${contacts.length} contacts to process`);

//     // Results tracking
//     const results = {
//       total: contacts.length,
//       sent: 0,
//       failed: 0,
//       invalid: 0,
//       details: []
//     };

//     for (const contact of contacts) {
//       try {
//         console.log(`🔍 Processing: ${contact.email}`);
        
//         // Verify email first
//         const verification = await verifyEmailHunter(contact.email);
        
//         if (verification.status === 'valid') {
//           // Email is valid - mark as verified immediately
//           await Campaign.updateOne(
//             { _id: campaignId, 'data.email': contact.email },
//             { $set: { 'data.$.isVerified': true } }
//           );
          
//           let emailSubject = subject;
//           let emailBody = body;
          
//           // Generate personalized content if not provided
//           if (!subject || !body) {
//             console.log(`🤖 Generating personalized content for ${contact.companyName || contact.email}`);
            
//             if (!subject) {
//               emailSubject = await generateSubjectLine(contact);
//               console.log(`📝 Generated subject: ${emailSubject}`);
//             }
            
//             if (!body) {
//               emailBody = await generateEmailBody(contact, emailSubject);
//               console.log(`📝 Generated body length: ${emailBody.length} characters`);
//             }
//           }
          
//           // Validate that we have subject and body now
//           if (!emailSubject || !emailBody) {
//             results.failed++;
//             results.details.push({
//               email: contact.email,
//               status: 'failed',
//               message: 'Could not generate email content',
//               verificationScore: verification.score,
//               isVerified: true
//             });
//             continue;
//           }
          
//           // Attempt to send email with personalized content
//           const sendResult = await sendEmail(contact.email, emailSubject, emailBody, fromEmail);
          
//           if (sendResult.success) {
//             results.sent++;
//             results.details.push({
//               email: contact.email,
//               companyName: contact.companyName,
//               contactName: contact.fullName || contact.firstName,
//               status: 'sent',
//               message: 'Email sent successfully',
//               verificationScore: verification.score,
//               isVerified: true,
//               generatedSubject: !subject ? emailSubject : undefined,
//               generatedBody: !body ? emailBody.substring(0, 100) + '...' : undefined
//             });
//           } else {
//             results.failed++;
//             results.details.push({
//               email: contact.email,
//               companyName: contact.companyName,
//               contactName: contact.fullName || contact.firstName,
//               status: 'failed',
//               message: sendResult.message,
//               verificationScore: verification.score,
//               isVerified: true
//             });
//           }
//         } else {
//           // Email is invalid or risky
//           results.invalid++;
//           results.details.push({
//             email: contact.email,
//             companyName: contact.companyName,
//             contactName: contact.fullName || contact.firstName,
//             status: 'invalid',
//             message: verification.reason,
//             verificationScore: verification.score
//           });
//         }
        
//         // Delay between emails (10 seconds + OpenAI API call time)
//         await new Promise(resolve => setTimeout(resolve, 10000));
        
//       } catch (error) {
//         console.error(`❌ Error processing ${contact.email}:`, error);
//         results.failed++;
//         results.details.push({
//           email: contact.email,
//           companyName: contact.companyName,
//           contactName: contact.fullName || contact.firstName,
//           status: 'error',
//           message: error.message || 'Unknown error occurred'
//         });
//       }
//     }

//     // Send response with results
//     res.json({ 
//       success: true, 
//       message: `Email campaign completed. Sent: ${results.sent}, Failed: ${results.failed}, Invalid: ${results.invalid}`,
//       campaign: {
//         id: campaign._id,
//         name: campaign.name
//       },
//       personalization: {
//         subjectGenerated: !subject,
//         bodyGenerated: !body
//       },
//       results: results
//     });

//   } catch (err) {
//     console.error("Error in send-mail route:", err);
//     res.status(500).json({ 
//       success: false, 
//       message: "Server error", 
//       error: err.message 
//     });
//   }
// });

// module.exports = router;






// const express = require('express');
// const Campaign = require('../models/Campaign');
// const { verifyEmailHunter } = require('../utils/hunterTypeVerify');
// const { sendEmail } = require('../utils/nodeMailer');
// const authMiddleware = require('../middlewares/authMiddleware');


// const router = express.Router();

// router.post("/send-mail", async (req, res) => {
//   try {
//     const { userId, campaignId, subject, body, fromEmail='kris@ovam.dev' } = req.body;

//     console.log('req.body--> ', req.body)
    
//     // Validation
//     if (!userId) {
//       return res.status(400).json({ success: false, message: "User ID required" });
//     }
    
//     if (!campaignId) {
//       return res.status(400).json({ success: false, message: "Campaign ID required" });
//     }
    
//     if (!subject || !body || !fromEmail) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "Subject, body, and fromEmail are required" 
//       });
//     }

//     // Fetch campaign based on campaignId and userId (for security)
//     const campaign = await Campaign.findOne({ 
//       _id: campaignId, 
//       owner: userId 
//     });

//     if (!campaign) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Campaign not found or you don't have access to it" 
//       });
//     }

//     // Extract emails from campaign data
//     const emails = campaign.data
//       .map(contact => contact.email)
//       .filter(email => email && email.trim() !== '') // Remove empty/null emails
//       .map(email => email.trim().toLowerCase()); // Clean emails

//     console.log('emails: ',emails)

//     if (emails.length === 0) {
//       return res.status(400).json({ 
//         success: false, 
//         message: "No valid emails found in the campaign" 
//       });
//     }

//     console.log(`📧 Found ${emails.length} emails to process`);

//     // Verify and send emails
//     const results = {
//       total: emails.length,
//       sent: 0,
//       failed: 0,
//       invalid: 0,
//       details: []
//     };

//     for (const email of emails) {

//       try {
//         console.log(`🔍 Processing: ${email}`);
        
//         // Verify email first
//         const verification = await verifyEmailHunter(email);
        
//         if (verification.status === 'valid') {
//           // Email is valid - mark as verified immediately
//           await Campaign.updateOne(
//             { _id: campaignId, 'data.email': email },
//             { $set: { 'data.$.isVerified': true } }
//           );
          
//           // Attempt to send email
//           const sendResult = await sendEmail(email, subject, body, fromEmail);
          
//           if (sendResult.success) {
//             results.sent++;
//             results.details.push({
//               email: email,
//               status: 'sent',
//               message: 'Email sent successfully',
//               verificationScore: verification.score,
//               isVerified: true
//             });
//           } else {
//             results.failed++;
//             results.details.push({
//               email: email,
//               status: 'failed',
//               message: sendResult.message,
//               verificationScore: verification.score,
//               isVerified: true // Still verified, just failed to send
//             });
//           }
//         } else {
//           // Email is invalid or risky
//           results.invalid++;
//           results.details.push({
//             email: email,
//             status: 'invalid',
//             message: verification.reason,
//             verificationScore: verification.score
//           });
//         }
        
//         // Here I am adding ten seconds delay also
//         await new Promise(resolve => setTimeout(resolve, 10000));
        
//       } catch (error) {
//         console.error(`❌ Error processing ${email}:`, error);
//         results.failed++;
//         results.details.push({
//           email: email,
//           status: 'error',
//           message: error.message || 'Unknown error occurred'
//         });
//       }
//     }

//     // Send response with results
//     res.json({ 
//       success: true, 
//       message: `Email campaign completed. Sent: ${results.sent}, Failed: ${results.failed}, Invalid: ${results.invalid}`,
//       campaign: {
//         id: campaign._id,
//         name: campaign.name
//       },
//       results: results
//     });

//   } catch (err) {
//     console.error("Error in send-mail route:", err);
//     res.status(500).json({ 
//       success: false, 
//       message: "Server error", 
//       error: err.message 
//     });
//   }
// });

// module.exports = router;

