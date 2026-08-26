const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());
// Variable to count POST requests
let postCount = 0;

// Middleware to track POST requests
app.use((req, res, next) => {
  if (req.method === 'POST') {
    postCount++;
    console.log(`[POST_STATS] Total POSTs: ${postCount}`);
  }
  next();
});

// Endpoint to view total POST requests count
app.get('/stats', (req, res) => {
  res.json({ total_post_requests: postCount });
});

// 🔓 دعم الـ CORS للروبوتات والـ AI Agents
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-payment-token');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const GROQ_API_KEY = process.env.GROQ_API_KEY;


// 2. توضيح الاستعمال فاش يدخل شي حد بـ GET لـ /scrape
app.get('/scrape', (req, res) => {
    res.status(200).json({
        message: "This is an M2M API endpoint. Please send a POST request with a JSON body.",
        example_body: { url: "https://example.com" }
    });
});

// 3. السماح لـ robots.txt
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send("User-agent: *\nAllow: /");
});
app.post('/scrape', async (req, res) => {
    console.log("Request Origin/Referer:", req.headers['referer'] || req.headers['origin'] || "Direct/No Referer");
    console.log("User-Agent:", req.headers['user-agent']);
    const { url, schema } = req.body;

    if (!url) {
        return res.status(400).json({ error: "Veuillez fournir l'URL du site web." });
    }

    return await scrapeAndExtractJSON(url, schema, res);
});

// 🛠️ دالة جلب الموقع وتحويله لـ JSON مثالي عبر الذكاء الاصطناعي
async function scrapeAndExtractJSON(targetUrl, userSchema, res) {
    try {
        const webResponse = await axios.get(targetUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
            },
            timeout: 10000
        });

        // 1️⃣ تحويل الاستجابة إلى نص أو JSON Object
        let parsedContent = webResponse.data;
        let cleanedText = "";

        if (typeof parsedContent === 'object') {
            cleanedText = JSON.stringify(parsedContent);
        } else {
            cleanedText = String(parsedContent)
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        cleanedText = cleanedText.substring(0, 6000);

        // 2️⃣ إيلا كان الموقع كيرجع JSON أصلاً، نرجعوه منظم ديريكت
        if (typeof parsedContent === 'object' && !userSchema) {
            return res.status(200).json({
                status: "success",
                source_url: targetUrl,
                extracted_data: parsedContent
            });
        }

        // 3️⃣ استخراج البيانات الهيكلية عبر Groq AI
        const schemaInstruction = userSchema 
            ? `Extract and map data using these keys/schema: ${JSON.stringify(userSchema)}`
            : "Extract all core data into a structured JSON object with clean key-value pairs.";

        const aiResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are a data extraction AI. Return ONLY a valid JSON object. No markdown block, no text before or after. ${schemaInstruction}`
                },
                { role: "user", content: `Extract clean JSON from this text:\n${cleanedText}` }
            ],
            response_format: { type: "json_object" }
        }, {
            headers: { 
                'Authorization': `Bearer ${GROQ_API_KEY}`, 
                'Content-Type': 'application/json' 
            }
        });

        let finalJson = JSON.parse(aiResponse.data.choices[0].message.content);

        return res.status(200).json({
            status: "success",
            source_url: targetUrl,
            extracted_data: finalJson
        });

    } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error("Scraping Error:", errDetail);
        return res.status(500).json({ error: "Failed to process JSON data.", detail: errDetail });
    }
  app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Smart Scraper M2M | AI-Powered Scraping API</title>
      <style>
        :root { --bg: #0b0f17; --card-bg: #161b26; --accent: #38bdf8; --text: #f8fafc; --text-muted: #94a3b8; --border: #1e293b; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: var(--bg); color: var(--text); display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 1.5rem; }
        .container { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 2.5rem; max-width: 520px; width: 100%; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4); text-align: center; }
        .badge { display: inline-block; background: rgba(56, 189, 248, 0.1); color: var(--accent); font-size: 0.8rem; font-weight: 600; padding: 0.3rem 0.8rem; border-radius: 20px; border: 1px solid rgba(56, 189, 248, 0.2); margin-bottom: 1rem; }
        h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.75rem; }
        p { color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; margin-bottom: 1.5rem; }
        .endpoint-box { background: #0f172a; border: 1px solid var(--border); border-radius: 8px; padding: 0.8rem 1rem; font-family: monospace; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
        .method { color: #4ade80; font-weight: bold; }
        .actions { display: flex; gap: 1rem; }
        .btn { flex: 1; text-align: center; padding: 0.75rem 1rem; border-radius: 8px; font-weight: 600; font-size: 0.9rem; text-decoration: none; transition: all 0.2s ease; }
        .btn-primary { background: var(--accent); color: #0f172a; }
        .btn-secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }
      </style>
    </head>
    <body>
      <div class="container">
        <span class="badge">● M2M Agent Endpoint Active</span>
        <h1>Smart Scraper M2M</h1>
        <p>An automated, high-performance web scraping API built for AI Agents and Machine-to-Machine integrations.</p>
        <div class="endpoint-box"><span class="method">POST</span><span>/api/scrape</span></div>
        <div class="actions">
          <a href="/stats" class="btn btn-secondary">View Live Stats</a>
          <a href="https://github.com/MRIGL/smart-scraper-m2m" target="_blank" class="btn btn-primary">GitHub Docs</a>
        </div>
      </div>
    </body>
    </html>
  `);
});
}

module.exports = app;
