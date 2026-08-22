const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

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

// المسار الرئيسي للخدمة (تفعيل وضع التجربة المجاني)
// 1. مسار ترحيبي للصفحة الرئيسية
app.get('/', (req, res) => {
    res.status(200).send("Smart Scraper M2M API is running! Send a POST request to /scrape.");
});

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
}

module.exports = app;
