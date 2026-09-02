const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let postCount = 0;

app.use((req, res, next) => {
  if (req.method === 'POST') {
    postCount++;
    console.log(`[POST_STATS] Total POSTs: ${postCount}`);
  }
  next();
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-payment-token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Smart Scraper M2M</title>
      <style>
        body { background: #0b0f17; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: #161b26; padding: 2.5rem; border-radius: 16px; border: 1px solid #1e293b; text-align: center; max-width: 480px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .badge { background: rgba(56,189,248,0.1); color: #38bdf8; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem; border: 1px solid rgba(56,189,248,0.2); }
        h1 { font-size: 1.8rem; margin: 1rem 0 0.5rem; }
        p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; }
        .input-group { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
        input { flex: 1; background: #0f172a; border: 1px solid #1e293b; padding: 0.75rem 1rem; border-radius: 8px; color: #fff; font-size: 0.9rem; outline: none; }
        input:focus { border-color: #38bdf8; }
        .btn { background: #38bdf8; color: #0f172a; padding: 0.75rem 1.2rem; border-radius: 8px; text-decoration: none; font-weight: 600; border: none; cursor: pointer; }
        .btn-sec { display: block; background: transparent; color: #94a3b8; text-decoration: none; font-size: 0.85rem; margin-top: 1rem; }
        .btn-sec:hover { color: #38bdf8; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge">● M2M Agent Endpoint Active</span>
        <h1>Smart Scraper M2M</h1>
        <p>An automated web scraping API built for AI Agents (Puppeteer-powered). Test a URL below:</p>
        
        <form action="/scrape" method="POST" class="input-group">
          <input type="url" name="url" placeholder="https://example.com" required>
          <button type="submit" class="btn">Scrape Now</button>
        </form>

        <a href="https://github.com/MRIGL/smart-scraper-m2m" target="_blank" class="btn-sec">View GitHub Docs & Stats</a>
      </div>
    </body>
    </html>
  `);
});

app.get('/stats', (req, res) => {
  res.json({ total_post_requests: postCount });
});

app.get('/scrape', (req, res) => {
  res.status(200).json({
    message: "This is an M2M API endpoint. Please send a POST request with a JSON body.",
    example_body: { url: "https://example.com" }
  });
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send("User-agent: *\nAllow: /");
});

app.post(['/scrape', '/api/scrape'], async (req, res) => {
  const url = req.body ? (req.body.url || req.body.targetUrl) : null;

  if (!url) {
    return res.status(400).json({ error: "Veuillez fournir l'URL du site web." });
  }

  return await scrapeWithPuppeteer(url, res);
});

async function scrapeWithPuppeteer(targetUrl, res) {
  let browser = null;
  try {
    // إعداد المتصفح لبيئة Vercel Serverless
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    // ضبط User-Agent لمنع الحظر
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // الانتقال للـ URL وانتظار تحميل الـ DOM
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // استخراج البيانات وتنسيقها كـ JSON
    const extractedData = await page.evaluate(() => {
      const getCleanText = (el) => el ? el.innerText.trim() : '';

      const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map(h => h.innerText.trim())
        .filter(text => text.length > 0);

      const paragraphs = Array.from(document.querySelectorAll('p'))
        .map(p => p.innerText.trim())
        .filter(text => text.length > 0)
        .slice(0, 15); // أخذ أول 15 فقرة

      const links = Array.from(document.querySelectorAll('a'))
        .map(a => ({ text: a.innerText.trim(), href: a.href }))
        .filter(link => link.text.length > 0 && link.href.startsWith('http'))
        .slice(0, 10); // أخذ أول 10 روابط

      return {
        title: document.title || '',
        headings: headings,
        paragraphs: paragraphs,
        links: links
      };
    });

    await browser.close();

    return res.status(200).json({
      status: "success",
      source_url: targetUrl,
      extracted_data: extractedData
    });

  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error("Puppeteer Scraping Error:", error.message);
    return res.status(500).json({ 
      error: "Failed to scrape target URL using Puppeteer.", 
      detail: error.message 
    });
  }
}

module.exports = app;
