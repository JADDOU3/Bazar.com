const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const CATALOG_SERVER = process.env.CATALOG_SERVER || 'http://localhost:3001';
const ORDER_SERVER = process.env.ORDER_SERVER || 'http://localhost:3002';

console.log(`[FRONTEND] Catalog Server: ${CATALOG_SERVER}`);
console.log(`[FRONTEND] Order Server: ${ORDER_SERVER}`);

app.get('/status', (req, res) => {
    res.json({ status: 'ok', service: 'frontend' });
});

app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Bazar.com - The World\'s Smallest Book Store',
        endpoints: {
            search: '/search/<topic>',
            info: '/info/<item_number>',
            purchase: '/purchase/<item_number>'
        }
    });
});

app.get('/search/:topic', async (req, res) => {
    const topic = req.params.topic;
    console.log(`[FRONTEND] Search request for topic: ${topic}`);

    try {
        const response = await axios.get(`${CATALOG_SERVER}/search/${topic}`);
        const results = response.data;

        console.log(`[FRONTEND] Found ${results.length} books for topic "${topic}"`);

        res.json({
            topic: topic,
            count: results.length,
            items: results
        });

    } catch (error) {
        console.error('[FRONTEND] Error in search:', error.message);
        if (error.response) {
            return res.status(error.response.status).json({
                error: error.response.data.error || 'Catalog service error'
            });
        } else if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ error: 'Catalog service unavailable' });
        } else {
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
});

app.get('/info/:item_number', async (req, res) => {
    const itemNumber = parseInt(req.params.item_number);
    console.log(`[FRONTEND] Info request for item ${itemNumber}`);

    try {
        const response = await axios.get(`${CATALOG_SERVER}/info/${itemNumber}`);
        const bookInfo = response.data;

        console.log(`[FRONTEND] Retrieved info for "${bookInfo.title}"`);

        bookInfo.item_number = itemNumber;
        bookInfo.stock_status = bookInfo.quantity > 0 ? 'In Stock' : 'Out of Stock';

        res.json(bookInfo);

    } catch (error) {
        console.error('[FRONTEND] Error in info:', error.message);
        if (error.response) {
            return res.status(error.response.status).json({
                error: error.response.data.error || 'Catalog service error'
            });
        } else if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ error: 'Catalog service unavailable' });
        } else {
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
});

// Purchase a book
app.post('/purchase/:item_number', async (req, res) => {
    const itemNumber = parseInt(req.params.item_number);
    console.log(`[FRONTEND] Purchase request for item ${itemNumber}`);

    try {
        const response = await axios.post(`${ORDER_SERVER}/purchase/${itemNumber}`);
        const orderInfo = response.data;

        console.log(`[FRONTEND] Purchase successful: bought book "${orderInfo.title}"`);

        res.json({
            success: true,
            item_number: itemNumber,
            title: orderInfo.title,
            price: orderInfo.price,
            message: `Successfully purchased "${orderInfo.title}"`
        });

    } catch (error) {
        console.error('[FRONTEND] Error in purchase:', error.message);
        if (error.response) {
            const status = error.response.status;
            const errorMsg = error.response.data.error || 'Order service error';
            console.log(`[FRONTEND] Purchase failed: ${errorMsg}`);
            return res.status(status).json({ error: errorMsg });
        } else if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ error: 'Order service unavailable' });
        } else {
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`[FRONTEND] Frontend server running on port ${PORT}`);
    console.log(`[FRONTEND] Connected to:`);
    console.log(`  - Catalog: ${CATALOG_SERVER}`);
    console.log(`  - Order: ${ORDER_SERVER}`);
});