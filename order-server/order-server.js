const express = require('express');
const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const app = express();
const PORT = 3002;
const CATALOG_SERVER = process.env.CATALOG_SERVER || 'http://localhost:3001';
const REPLICA_SERVER = process.env.REPLICA_SERVER || null;

app.use(express.json());

// Sync order with replica
async function syncOrderWithReplica(order) {
    if (!REPLICA_SERVER) return;
    
    try {
        await axios.post(`${REPLICA_SERVER}/sync-order`, { order });
        console.log(`[ORDER] Synced order to replica for item ${order.id}`);
    } catch (error) {
        console.error(`[ORDER] Failed to sync with replica: ${error.message}`);
    }
}

function logOrder(order) {
    const csvWriter = createCsvWriter({
        path: './orders.csv',
        header: [
            { id: 'id', title: 'id' },
            { id: 'title', title: 'title' },
            { id: 'topic', title: 'topic' },
            { id: 'quantity', title: 'quantity' },
            { id: 'price', title: 'price' }
        ],
        append: true
    });
    return csvWriter.writeRecords([order]);
}

app.post('/purchase/:item_number', async (req, res) => {
    const itemNumber = parseInt(req.params.item_number);
    console.log(`[ORDER] Purchase request for item ${itemNumber}`);

    try {
        const infoResponse = await axios.get(`${CATALOG_SERVER}/info/${itemNumber}`);

        if (!infoResponse.data) {
            console.log(`[ORDER] Item ${itemNumber} not found`);
            return res.status(404).json({ error: 'Item not found' });
        }

        const itemInfo = infoResponse.data;

        if (itemInfo.quantity <= 0) {
            console.log(`[ORDER] Item ${itemNumber} is out of stock`);
            return res.status(400).json({ error: 'Out of stock' });
        }

        const decrementResponse = await axios.put(`${CATALOG_SERVER}/decrement/${itemNumber}`);

        if (decrementResponse.status !== 200) {
            const errorMsg = (decrementResponse.data && decrementResponse.data.error) || 'Failed to update stock';
            console.log(`[ORDER] Failed to decrement stock: ${errorMsg}`);
            return res.status(400).json({ error: errorMsg });
        }

        const order = {
            id: itemNumber,
            title: itemInfo.title,
            topic: itemInfo.topic,
            quantity: itemInfo.quantity,
            price: itemInfo.price
        };

        await logOrder(order);
        
        // Sync with replica
        await syncOrderWithReplica(order);

        const result = {
            item_id: itemNumber,
            title: itemInfo.title,
            price: itemInfo.price,
            message: 'Purchase successful'
        };

        console.log(`[ORDER] Purchase completed: bought book "${itemInfo.title}"`);
        res.json(result);

    } catch (error) {
        if (error.response) {
            console.log(`[ORDER] Error from catalog service: ${error.response.status}`);
            return res.status(error.response.status).json({
                error: (error.response.data && error.response.data.error) || 'Catalog service error'
            });
        } else if (error.code === 'ECONNREFUSED') {
            console.log('[ORDER] Error: Cannot connect to catalog server');
            return res.status(503).json({ error: 'Catalog service unavailable' });
        } else {
            console.error('[ORDER] Error processing purchase:', error.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
});

app.get('/orders', (req, res) => {
    const fs = require('fs');
    const csv = require('csv-parser');
    const orders = [];

    fs.createReadStream('./orders.csv')
        .pipe(csv())
        .on('data', (data) => {
            orders.push(data);
        })
        .on('end', () => {
            console.log(`[ORDER] Retrieved ${orders.length} orders`);
            res.json(orders);
        })
        .on('error', (error) => {
            console.error('[ORDER] Error reading orders:', error);
            res.status(500).json({ error: 'Error reading orders' });
        });
});

app.get('/status', (req, res) => {
    res.json({ status: 'ok' });
});

// Sync endpoint for replica (receives order from primary)
app.post('/sync-order', async (req, res) => {
    const { order } = req.body;
    
    console.log(`[ORDER] Received sync order for item ${order.id}`);
    
    try {
        await logOrder(order);
        res.json({ success: true });
    } catch (error) {
        console.error('[ORDER] Error syncing order:', error);
        res.status(500).json({ error: 'Error syncing order' });
    }
});

app.listen(PORT, () => {
    console.log(`[ORDER] Order service running on port ${PORT}`);
    console.log(`[ORDER] Configured to connect to catalog at ${CATALOG_SERVER}`);
});