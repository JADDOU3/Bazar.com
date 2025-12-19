const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000;

app.use(express.json());

// Replica servers
const catalogServers = [
    process.env.CATALOG_SERVER_1 || 'http://localhost:3001',
    process.env.CATALOG_SERVER_2 || 'http://localhost:3003'
];
const orderServers = [
    process.env.ORDER_SERVER_1 || 'http://localhost:3002',
    process.env.ORDER_SERVER_2 || 'http://localhost:3004'
];

// In-memory cache
const cache = new Map();
const CACHE_TTL = 10000; // 10 seconds

// Round-robin indices
let catalogIndex = 0;
let orderIndex = 0;

// Get next catalog server (round-robin)
function getNextCatalogServer() {
    const server = catalogServers[catalogIndex];
    catalogIndex = (catalogIndex + 1) % catalogServers.length;
    return server;
}

// Get next order server (round-robin)
function getNextOrderServer() {
    const server = orderServers[orderIndex];
    orderIndex = (orderIndex + 1) % orderServers.length;
    return server;
}

// Try request with fallback to replica
async function tryRequestWithFallback(servers, config) {
    const errors = [];
    for (const server of servers) {
        try {
            const response = await axios({
                ...config,
                baseURL: server
            });
            return response;
        } catch (error) {
            errors.push({ server, error: error.message });
            console.log(`[FRONTEND] Failed to connect to ${server}, trying next replica...`);
        }
    }
    throw new Error(`All servers failed: ${JSON.stringify(errors)}`);
}

app.get('/search/:topic', async (req, res) => {
    const topic = req.params.topic;
    const cacheKey = `search_${topic}`;
    
    console.log(`[FRONTEND] Search request for topic: ${topic}`);
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[FRONTEND] Cache hit for topic: ${topic}`);
        return res.json(cached.data);
    }
    
    try {
        const response = await tryRequestWithFallback(catalogServers, {
            method: 'GET',
            url: `/search/${topic}`
        });
        
        // Store in cache
        cache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now()
        });
        console.log(`[FRONTEND] Cached results for topic: ${topic}`);
        
        res.json(response.data);
    } catch (error) {
        console.error('[FRONTEND] Error fetching data from catalog service:', error.message);
        res.status(500).json({ 
            error: 'Error fetching data from catalog service' 
        });
    }
});

app.get('/info/:item_number', async (req, res) => {
    const itemNumber = req.params.item_number;
    const cacheKey = `info_${itemNumber}`;
    
    console.log(`[FRONTEND] Info request for item: ${itemNumber}`);
    
    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[FRONTEND] Cache hit for item: ${itemNumber}`);
        return res.json(cached.data);
    }
    
    try {
        const response = await tryRequestWithFallback(catalogServers, {
            method: 'GET',
            url: `/info/${itemNumber}`
        });
        
        // Store in cache
        cache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now()
        });
        console.log(`[FRONTEND] Cached info for item: ${itemNumber}`);
        
        res.json(response.data);
    } catch (error) {
        console.error('[FRONTEND] Error fetching data from catalog service:', error.message);
        res.status(error.response?.status || 500).json({ 
            error: error.response?.data?.error || 'Error fetching data from catalog service' 
        });
    }
});

app.post('/purchase/:item_number', async (req, res) => {
    const itemNumber = req.params.item_number;
    console.log(`[FRONTEND] Purchase request for item: ${itemNumber}`);
    
    try {
        const response = await tryRequestWithFallback(orderServers, {
            method: 'POST',
            url: `/purchase/${itemNumber}`
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('[FRONTEND] Error processing purchase:', error.message);
        res.status(500).json({ 
            error: 'Error processing purchase' 
        });
    }
});

// Cache invalidation endpoint (called by backend servers)
app.post('/invalidate/:item_number', (req, res) => {
    const itemNumber = req.params.item_number;
    const cacheKey = `info_${itemNumber}`;
    
    cache.delete(cacheKey);
    console.log(`[FRONTEND] Cache invalidated for item: ${itemNumber}`);
    
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`[FRONTEND] Frontend service running on port ${PORT}`);
    console.log(`[FRONTEND] Catalog servers: ${catalogServers.join(', ')}`);
    console.log(`[FRONTEND] Order servers: ${orderServers.join(', ')}`);
    console.log(`[FRONTEND] Cache TTL: ${CACHE_TTL}ms`);
});