

const { chromium } = require('playwright');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const crypto = require('crypto');

const app = express();
const port = 8000;

// Use sessions
const secretKey = crypto.randomBytes(32).toString('hex');

app.use(cors());

// Create a browser pool
const browserPool = {
  browsers: [],
  async acquire() {
    if (this.browsers.length === 0) {
      const browser = await chromium.launch({ headless: true });
      this.browsers.push(browser);
    }
    return this.browsers.pop();
  },
  release(browser) {
    this.browsers.push(browser);
  },
};

// Use sessions
app.use(session({
  secret: secretKey,
  resave: false,
  saveUninitialized: true,
}));

// Middleware to track active sessions
app.use((req, res, next) => {
  req.session.lastActivity = Date.now();
  next();
});

app.get('/', (req, res) => {
  res.send('Hello, this is the root rout  e!');
});

async function scrapeUserData(username) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
  });

  const page = await context.newPage();

  try {
    // Scrape follower count
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`https://livecounts.io/embed/twitter-live-follower-counter/${username}`, { waitUntil: 'domcontentloaded', timeout: 0 });
    await page.waitForTimeout(5000);

    const followerCount = await page.evaluate(() => {
      const followerCountElements = Array.from(document.querySelectorAll('.odometer-value')).slice(0, 9);
      return followerCountElements.map(element => element.textContent).join('');
    });

    console.log(`Twitter Follower Count: ${followerCount}`);


    const avatarSrc = await page.$eval('img', imgElement => imgElement.src);

    console.log(`Twitter Profile Picture URL: ${avatarSrc}`);

    return { followerCount, profilePicUrl: avatarSrc };
  } finally {
    await context.close();
    await browser.close();
  }
}

app.get('/user-details', async (req, res) => {
  try {
    const username = req.query.username;
    const userData = await scrapeUserData(username);
    res.json(userData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at https://localhost:${port}`);
});
