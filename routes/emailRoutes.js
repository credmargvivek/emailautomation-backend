// routes/emailRoutes.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const pLimit = require('p-limit');
const { sendEmail } = require('../utils/nodeMailer');
const { emailTemplates } = require('../utils/emailTemplates');
const router = express.Router();
const CONCURRENCY = 5;
const limit = pLimit(CONCURRENCY);
const authMiddleware = require('../middlewares/authMiddleware');

const loadEmailsFromCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const emails = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        if (row.email) emails.push(row.email.trim());
      })
      .on('end', () => resolve(emails))
      .on('error', (err) => reject(err));
  });
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

router.get('/send-emails', authMiddleware, async (req, res) => {
  try {
    const recipients = await loadEmailsFromCSV(path.join(__dirname, '../emails.csv'));
    const fromEmails = await loadEmailsFromCSV(path.join(__dirname, '../from_emails.csv'));

    if (!recipients.length || !fromEmails.length) {
      return res.status(400).json({ success: false, error: 'CSV files are empty or missing' });
    }

    let results = [];
    let successCount = 0;
    let failCount = 0;

    const tasks = recipients.map((to, i) =>
      limit(async () => {
        const from = fromEmails[Math.floor(i / 2) % fromEmails.length];
        await delay(0);
        if (i % 2 === 0 && i !== 0) {
          await delay(0);
        }

        try {
          const { subject, body } = emailTemplates.prReview1({
            firstName: to.split('@')[0].replace(/[0-9]/g, ''),
            company: 'ovam.ai',
            from,
          });

          const response = await sendEmail(to, subject, body, from);

          if (response.success) {
            successCount++;
            return { to, from, status: 'sent', messageId: response.result?.MessageId };
          } else {
            failCount++;
            return { to, from, status: 'failed', error: response.message };
          }
        } catch (err) {
          failCount++;
          return { to, from, status: 'failed', error: err.message };
        }
      })
    );

    results = await Promise.all(tasks);

    res.json({
      success: true,
      total: recipients.length,
      successCount,
      failCount,
      results,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;