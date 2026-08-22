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
const SWISS_API_KEY = process.env.SWISS_API_KEY;

// المسار الرئيسي للخدمة (تفعيل وضع التجربة المجاني)
app.post('/scrape', async (req, res) => {
    const { url, schema } = req.body;

    if (!url) {
        return res.status(400).json({ error: "Veuillez fournir l'URL du site web." });
    }

    // 🧪 TEST MODE: الاستخراج المباشر للداتا بلا ما نطلبو الفاتورة (402)
    return await scrapeAndExtractJSON(url, schema, res);
});

// 🛠️ دالة جلب الموقع وتحويله لـ JSON نقي عبر الذكاء الاصطناعي
async function scrapeAndExtractJSON(targetUrl, userSchema, res) {
    try {
        const webResponse = await axios.get(targetUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
            },
            timeout: 10000
        });

        const htmlContent = webResponse.data;

        // تنقية الـ HTML من الكود الزايد
        const cleanedText = htmlContent
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 6000);

        const schemaInstruction = userSchema 
            ? `Extract the data according to this requested schema/keys: ${JSON.stringify(userSchema)}`
            : "Extract all relevant key information (e.g., titles, prices, specs, features, contact, metadata) as a clean key-value JSON object.";

        const aiResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: `You are an expert web data extraction AI. Output ONLY valid, raw JSON. Do not write any markdown code blocks (like \`\`\`json), no introductions, and no explanations. ${schemaInstruction}`
                },
                { role: "user", content: `Extract data from this website content:\n${cleanedText}` }
            ],
            response_format: { type: "json_object" }
        }, {
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }
        });

        const rawJsonString = aiResponse.data.choices[0].message.content;
        const extractedData = JSON.parse(rawJsonString);

        return res.status(200).json({
            status: "success",
            source_url: targetUrl,
            extracted_data: extractedData
        });

    } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error("Scraping/Groq Error:", errDetail);
        return res.status(500).json({ error: "Failed to scrape or extract JSON data.", detail: errDetail });
    }
}

module.exports = app;
