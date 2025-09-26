const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const Campaign = require('../models/Campaign');
const User = require('../models/User');

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/campaign-upload', upload.single('csv'), async (req, res) => {
  try {
    console.log('Received upload-campaign request');

    const { campaignName, userId } = req.body;
    if (!campaignName || !userId) {
      return res.status(400).json({ success: false, message: 'Campaign name and user ID are required.' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!req.file) return res.status(400).json({ success: false, message: 'CSV file is required.' });

    const rows = [];
    let rowNumber = 0;
    let stopParsing = false;
    let parsingError = null;

    const readable = require('stream').Readable.from(req.file.buffer);

    readable
      .pipe(csv(['firstName', 'lastName', 'domain', 'companyName', 'fullName', 'email'], { skipLines: 1 }))
      .on('data', (row) => {
        rowNumber++;
        if (stopParsing) return;

        // Trim values
        Object.keys(row).forEach((k) => { row[k] = row[k]?.trim(); });

        // Keep only first 6 columns
        row = {
          firstName: row.firstName,
          lastName: row.lastName,
          domain: row.domain,
          companyName: row.companyName,
          fullName: row.fullName || '',
          email: row.email || '',
        };

        const firstFour = [row.firstName, row.lastName, row.domain, row.companyName];

        // Case: first column empty
        if (!row.firstName) {
          const isEmptyRow = firstFour.every((v) => !v) && !row.fullName && !row.email;
          if (isEmptyRow) {
            console.log(`Empty first column and row at ${rowNumber}, stopping parsing and saving campaign.`);
            stopParsing = true; // stop parsing but don't set error
            return;
          } else {
            parsingError = `Missing firstName at row ${rowNumber} but row is not completely empty.`;
            stopParsing = true;
            return;
          }
        }

        // Case: 2nd, 3rd, 4th column empty → error
        if (!row.lastName || !row.domain || !row.companyName) {
          parsingError = `Missing required field at row ${rowNumber} (lastName/domain/companyName).`;
          stopParsing = true;
          return;
        }

        rows.push(row);
        console.log('Row added:', rowNumber, row);
      })
      .on('end', async () => {
        console.log('CSV parsing ended');

        if (rows.length === 0) {
          return res.status(400).json({ success: false, message: parsingError || 'No valid rows found in CSV.' });
        }

        if (parsingError) {
          return res.status(400).json({ success: false, message: parsingError });
        }

        const campaign = new Campaign({
          owner: user._id,
          name: campaignName,
          data: rows,
        });

        await campaign.save();
        console.log('Campaign saved successfully:', campaign._id);

        return res.json({
          success: true,
          message: 'Campaign uploaded successfully',
          campaignId: campaign._id,
        });
      })
      .on('error', (err) => {
        console.error('CSV parse error:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Error parsing CSV.' });
        }
      });

  } catch (err) {
    console.error('Server error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
});

router.post("/campaign-data", async (req, res) => {
  try {
    const { campaignId } = req.body;
    if (!campaignId) {
      return res.status(400).json({ success: false, message: "Campaign ID is required" });
    }

    const campaign = await Campaign.findById(campaignId).lean();
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    res.json({
      success: true,
      campaign: {
        id: campaign._id,
        name: campaign.name,
        data: campaign.data,
      },
    });
  } catch (err) {
    console.error("Error fetching campaign data:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/campaign-list", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    const campaigns = await Campaign.find({ owner: userId }).sort({ createdAt: -1 });
    res.json({ success: true, campaigns });
  } catch (err) {
    console.error("Error fetching campaigns:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/campaign-delete/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, message: "Campaign ID is required" });
  }

  try {
    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    await campaign.deleteOne();

    return res.json({ success: true, message: "Campaign deleted successfully" });
  } catch (err) {
    console.error("Error deleting campaign:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/campaign-edit/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "Campaign name is required." });
  }

  try {
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found." });
    }

    // Update campaign name
    campaign.name = name.trim();
    await campaign.save();

    res.json({ success: true, message: "Campaign updated successfully.", campaign });
  } catch (err) {
    console.error("Error editing campaign:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

router.post("/campaign-edit", upload.single("csv"), async (req, res) => {
  try {
    console.log("Received edit-campaign request");

    const { campaignId, userId } = req.body;
    if (!campaignId || !userId) {
      return res
        .status(400)
        .json({ success: false, message: "Campaign ID and user ID are required." });
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found." });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "CSV file is required." });
    }

    const rows = [];
    let rowNumber = 0;
    let stopParsing = false;
    let parsingError = null;

    const readable = require("stream").Readable.from(req.file.buffer);

    readable
      .pipe(
        csv(
          ["firstName", "lastName", "domain", "companyName", "fullName", "email"],
          { skipLines: 1 } // skip first line (headers)
        )
      )
      .on("data", (row) => {
        rowNumber++;
        if (stopParsing) return;

        // 🔥 Extra safeguard: skip the very first row (header row)
        if (rowNumber === 1) {
          return;
        }

        // Trim values
        Object.keys(row).forEach((k) => {
          row[k] = row[k]?.trim();
        });

        // Keep only first 6 columns
        row = {
          firstName: row.firstName,
          lastName: row.lastName,
          domain: row.domain,
          companyName: row.companyName,
          fullName: row.fullName || "",
          email: row.email || "",
        };

        const firstFour = [row.firstName, row.lastName, row.domain, row.companyName];

        // Case: first column empty
        if (!row.firstName) {
          const isEmptyRow = firstFour.every((v) => !v) && !row.fullName && !row.email;
          if (isEmptyRow) {
            console.log(`Empty first column and row at ${rowNumber}, stopping parsing.`);
            stopParsing = true;
            return;
          } else {
            parsingError = `Missing firstName at row ${rowNumber} but row is not completely empty.`;
            stopParsing = true;
            return;
          }
        }

        // Case: 2nd, 3rd, 4th column empty → error
        if (!row.lastName || !row.domain || !row.companyName) {
          parsingError = `Missing required field at row ${rowNumber} (lastName/domain/companyName).`;
          stopParsing = true;
          return;
        }

        rows.push(row);
      })
      .on("end", async () => {
        if (rows.length === 0) {
          return res
            .status(400)
            .json({ success: false, message: parsingError || "No valid rows found in CSV." });
        }

        if (parsingError) {
          return res.status(400).json({ success: false, message: parsingError });
        }

        // Append new rows to existing data
        campaign.data.push(...rows);

        await campaign.save();
        console.log(`Campaign ${campaignId} updated with ${rows.length} new rows.`);

        return res.json({
          success: true,
          message: "Campaign updated successfully",
          campaignId: campaign._id,
          newRows: rows.length,
          totalRows: campaign.data.length,
        });
      })
      .on("error", (err) => {
        console.error("CSV parse error:", err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: "Error parsing CSV." });
        }
      });
  } catch (err) {
    console.error("Server error:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
});



module.exports = router;
