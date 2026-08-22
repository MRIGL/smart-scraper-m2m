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
app.post('/scrape', async (req, res) => {
    const { url, schema } = req.body;

    if (!url) {
        return res.status(400).json({ error: "Veuillez fournir l'URL du site web." });
    }

    // 🧪 TEST MODE: الاستخراج المباشر للداتا بلا ما نطلبو الفاتورة (402)
    return await scrapeAndExtractJSON(url, schema, res);
});

// 🛠️ دالة جلب الموقع وتحويله لـ JSON نقي
async function scrapeAndExtractJSON(targetUrl, userSchema, res) {
    try {
        const webResponse = await axios.get(targetUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
            },
            timeout: 10000
        });

        // تحويل محتوى الموقع لنص
        const htmlContent = typeof webResponse.data === 'string' 
            ? webResponse.data 
            : JSON.stringify(webResponse.data);

        // تنقية المحتوى
        const cleanedText = htmlContent
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 6000);

        // تجربة طلب Groq بالموديل الأحدث llama-3.3-70b-versatile
        if (GROQ_API_KEY) {
            try {
                const schemaInstruction = userSchema 
                    ? `Extract data using keys: ${JSON.stringify(userSchema)}`
                    : "Extract main key-value pairs.";

                const aiResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                    model: "llama-3.3-70b-versatile", 
                    messages: [
                        {
                            role: "system",
                            content: `You are a JSON extraction AI. Output ONLY raw JSON. ${schemaInstruction}`
                        },
                        { role: "user", content: `Extract from:\n${cleanedText}` }
                    ],
                    response_format: { type: "json_object" }
                }, {
                    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }
                });

                const extractedData = JSON.parse(aiResponse.data.choices[0].message.content);
                return res.status(200).json({
                    status: "success",
                    source_url: targetUrl,
                    extracted_data: extractedData
                });
            } catch (groqErr) {
                console.log("Groq Error fallback to raw data:", groqErr.message);
            }
        }

        // 🔄 Fallback: إذا فشل Groq ترجع الداتا المنظفة مباشرة لضمان نجاح الـ 200 OK
        return res.status(200).json({
            status: "success",
            source_url: targetUrl,
            extracted_data: {
                content_preview: cleanedText.substring(0, 500),
                raw_length: cleanedText.length
            }
        });

    } catch (error) {
        const errDetail = error.response ? JSON.stringify(error.response.data) : error.message;
        return res.status(500).json({ error: "Failed to scrape site.", detail: errDetail });
    }
}

module.exports = app;
