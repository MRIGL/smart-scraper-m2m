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

// المسار الرئيسي للخدمة
app.post('/scrape', async (req, res) => {
    const { url, schema } = req.body;
    const paymentToken = req.headers['x-payment-token'];

    if (!url) {
        return res.status(400).json({ error: "Veuillez fournir l'URL du site web." });
    }

    // 1️⃣ إيلا صيفط الروبوت Token الخلاص (تأكيد الفاتورة)
    if (paymentToken) {
        try {
            const checkResponse = await axios.get(`https://api.swiss-bitcoin-pay.ch/checkout/${paymentToken}`);
            const invoice = checkResponse.data;

            if (invoice.isExpired) {
                return res.status(410).json({ error: "Invoice expired.", invoiceId: paymentToken });
            }

            if (invoice.isPaid) {
                // الخلاص داز بنجاح ⚡ غانديروا الاستخراج دابا
                return await scrapeAndExtractJSON(url, schema, res);
            }

            return res.status(402).json({ error: "Invoice not paid yet.", invoiceId: paymentToken });

        } catch (err) {
            const errDetail = err.response ? JSON.stringify(err.response.data) : err.message;
            console.error("Swiss Bitcoin Pay check error:", errDetail);
            return res.status(500).json({ error: "Erreur de vérification du paiement.", detail: errDetail });
        }
    }

    // 2️⃣ أول طلب (طلب الفاتورة بـ HTTP 402)
    try {
        const swissResponse = await axios.post('https://api.swiss-bitcoin-pay.ch/checkout', {
            amount: 0.02, // الثمن بـ EUR
            unit: "EUR",
            title: "Smart Web Data Scraper to JSON",
            description: "Extraction de données structurées en JSON pour AI Agents"
        }, {
            headers: { 'api-key': SWISS_API_KEY, 'Content-Type': 'application/json' }
        });

        const invoiceId = swissResponse.data.id;
        const invoicePr = swissResponse.data.pr;

        res.setHeader('X-Invoice', invoicePr);
        res.setHeader('X-Checking-Id', invoiceId);
        
        return res.status(402).json({
            error: "Payment Required",
            message: "Pay the Lightning invoice to extract structured JSON data.",
            invoiceId: invoiceId,
            paymentRequest: invoicePr
        });

    } catch (err) {
        const errorDetail = err.response ? JSON.stringify(err.response.data) : err.message;
        console.error("Swiss Bitcoin Pay Error:", errorDetail);
        return res.status(500).json({ error: "Erreur de paiement.", detail: errorDetail });
    }
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
