const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const app = express();
const PORT = 3001;

let catalog = [];

fs.createReadStream('./catalog.csv')
    .pipe(csv())
    .on('data', (data) => {
        data.id = parseInt(data.id);
        data.price = parseFloat(data.price);
        data.quantity = parseInt(data.quantity);
        catalog.push(data);
    })
    .on('end', () => {
        console.log('[CATALOG] CSV file successfully processed');
        console.log(`[CATALOG] Loaded ${catalog.length} books`);
    });

app.use(express.json());

app.get('/search/:topic', (req, res) => {
    const topic = req.params.topic.replace(/%20/g, ' ');
    console.log(`[CATALOG] Search request for topic: ${topic}`);

    const result = catalog.filter(book =>
        book.topic.toLowerCase() === topic.toLowerCase()
    );

    if (result.length > 0) {
        const formatted = result.map(book => ({
            id: book.id,
            title: book.title
        }));
        console.log(`[CATALOG] Found ${formatted.length} books for topic "${topic}"`);
        res.json(formatted);
    } else {
        console.log(`[CATALOG] No books found for topic "${topic}"`);
        res.status(404).json({ error: 'No books found for this topic' });
    }
});

app.get('/info/:item_number', (req, res) => {
    const itemNumber = parseInt(req.params.item_number);
    console.log(`[CATALOG] Info request for item ${itemNumber}`);

    const book = catalog.find(book => book.id === itemNumber);

    if (book) {
        const info = {
            title: book.title,
            topic: book.topic,
            quantity: book.quantity,
            price: book.price
        };
        console.log(`[CATALOG] Found book: ${book.title}`);
        res.json(info);
    } else {
        console.log(`[CATALOG] Book not found: ${itemNumber}`);
        res.status(404).json({ error: 'Book not found' });
    }
});

app.put('/update/:item_number', (req, res) => {
    const itemNumber = parseInt(req.params.item_number);
    const { quantity, price } = req.body;

    console.log(`[CATALOG] Update request for item ${itemNumber}`);

    const book = catalog.find(book => book.id === itemNumber);

    if (book) {
        if (quantity !== undefined) {
            book.quantity = parseInt(quantity);
            console.log(`[CATALOG] Updated quantity for item ${itemNumber} to ${book.quantity}`);
        }
        if (price !== undefined) {
            book.price = parseFloat(price);
            console.log(`[CATALOG] Updated price for item ${itemNumber} to ${book.price}`);
        }

        const csvWriter = createCsvWriter({
            path: './catalog.csv',
            header: [
                { id: 'id', title: 'id' },
                { id: 'title', title: 'title' },
                { id: 'topic', title: 'topic' },
                { id: 'quantity', title: 'quantity' },
                { id: 'price', title: 'price' }
            ]
        });

        csvWriter.writeRecords(catalog)
            .then(() => {
                console.log('[CATALOG] CSV file updated successfully');
                res.json({ success: true, message: 'Item updated' });
            })
            .catch((error) => {
                console.error('[CATALOG] Error writing CSV file:', error);
                res.status(500).json({ error: 'Error updating CSV file' });
            });
    } else {
        console.log(`[CATALOG] Book not found: ${itemNumber}`);
        res.status(404).json({ error: 'Book not found' });
    }
});

app.post('/decrement/:item_number', (req, res) => {
    const itemNumber = parseInt(req.params.item_number);
    console.log(`[CATALOG] Decrement request for item ${itemNumber}`);

    const book = catalog.find(book => book.id === itemNumber);

    if (book) {
        if (book.quantity > 0) {
            book.quantity -= 1;

            const csvWriter = createCsvWriter({
                path: './catalog.csv',
                header: [
                    { id: 'id', title: 'id' },
                    { id: 'title', title: 'title' },
                    { id: 'topic', title: 'topic' },
                    { id: 'quantity', title: 'quantity' },
                    { id: 'price', title: 'price' }
                ]
            });

            csvWriter.writeRecords(catalog)
                .then(() => {
                    console.log(`[CATALOG] Decremented stock for item ${itemNumber}, new quantity: ${book.quantity}`);
                    res.json({ success: true, quantity: book.quantity });
                })
                .catch((error) => {
                    console.error('[CATALOG] Error writing CSV file:', error);
                    res.status(500).json({ error: 'Error updating CSV file' });
                });
        } else {
            console.log(`[CATALOG] Item ${itemNumber} out of stock`);
            res.status(400).json({ error: 'Out of stock' });
        }
    } else {
        console.log(`[CATALOG] Book not found: ${itemNumber}`);
        res.status(404).json({ error: 'Book not found' });
    }
});

app.listen(PORT, () => {
    console.log(`[CATALOG] Catalog service running on port ${PORT}`);
});