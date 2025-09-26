const puppeteer = require("puppeteer");
const fs = require("fs");
const { URL } = require("url");

function randomDelay(min = 1000, max = 5000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Human-like scroll
async function autoScroll(page) {
  await page.evaluate(async () => {
    const distance = 200;
    for (let i = 0; i < 10; i++) {
      window.scrollBy(0, distance);
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    }
  });
}

async function startScraping() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      userDataDir: "/path/to/your/chrome/profile",
      defaultViewport: null,
      args: ["--start-maximized"]
    });

    const [page] = await browser.pages();

    console.log("Opening LinkedIn Feed…");
    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    // Check CAPTCHA
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (/captcha|verify|suspicious/i.test(bodyText)) {
      console.log("❌ CAPTCHA detected. Exiting...");
      await browser.close();
      process.exit(1);
    }

    // Search for CEOs
    const searchQuery = "CEO";
    const countryFilter = "103644278";
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
      searchQuery
    )}&origin=GLOBAL_SEARCH_HEADER&geoUrn=${countryFilter}&page=1`;

    console.log("🔍 Visiting search page");
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await delay(randomDelay(3000, 6000));
    await autoScroll(page);

    // Collect profile URLs
    await page.waitForSelector('a[href*="/in/"]', { timeout: 15000 });
    const profiles = await page.$$eval('a[href*="/in/"]', links =>
      Array.from(new Set(links.map(a => a.href.split("?")[0])))
    );

    console.log(`📌 Found ${profiles.length} profiles`);

    for (const profileLink of profiles) {
      console.log(`🔗 Visiting profile: ${profileLink}`);
      await delay(randomDelay(5000, 10000));

      // Retry navigation
      let success = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.goto(profileLink, { waitUntil: "domcontentloaded", timeout: 60000 });
          success = true;
          break;
        } catch (err) {
          console.warn(`⚠️ Navigation failed (attempt ${attempt}): ${err.message}`);
          await delay(randomDelay(4000, 7000));
        }
      }
      if (!success) {
        console.log("❌ Skipping profile due to repeated failures");
        continue;
      }

      // Handle any popup: click "Cancel" or exit
      const popup = await page.$('button[aria-label="Cancel"], button[aria-label="Dismiss"]');
      if (popup) {
        console.log("⚠️ Popup detected, clicking Cancel");
        await popup.click();
        await delay(randomDelay(1000, 2000));
      }

      // Extract emails if needed
      const emails = await page.evaluate(() => {
        const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g;
        return Array.from(new Set(document.body.innerText.match(regex) || []));
      });
      if (emails.length) console.log("📧 Emails found:", emails);

      // Like first post only
// Like first post properly
const posts = await page.$$('div.feed-shared-update-v2, div.occludable-update');
if (posts.length > 0) {
  try {
    await posts[0].evaluate(el => el.scrollIntoView({ behavior: "smooth", block: "center" }));
    await delay(randomDelay(500, 1000));

    // Find the Like button
    const likeBtn = await posts[0].$('button[aria-label*="Like"]');

    if (likeBtn) {
      // Use Puppeteer's click directly, ensure proper click
      await likeBtn.click({ delay: 100 }); // small delay simulates human click

      console.log("👍 Liked a post properly");
      await delay(randomDelay(1000, 2000));
    }
  } catch (err) {
    console.error("❌ Error liking post:", err.message);
  }
}


      await delay(randomDelay(5000, 10000)); // wait before next profile
    }

    await browser.close();
    console.log("✅ Finished safely");
  } catch (err) {
    console.error("🔥 Fatal error:", err.message);
    if (browser) await browser.close();
  }
}

module.exports = startScraping;
