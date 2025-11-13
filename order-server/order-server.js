const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const app = express();
const PORT = 3002;

let catalog = [];

fs.createReadStream('./proj.csv')
    .pipe(csv())
    .on('data', (data) => {
        data.id = parseInt(data.id);
        data.price = parseFloat(data.price);
        data.stock = parseInt(data.stock);
        catalog.push(data);
    })
    .on('end', () => {
        console.log('CSV file successfully processed');
    });

app.use(express.json());

function logOrder(order) {
    const csvWriter = createCsvWriter({
        path: 'C:\\Users\\fadih\\dosProject_Part1\\orders.csv',
        header: [
            { id: 'order_id', title: 'order_id' },
            { id: 'item_id', title: 'item_id' },
            { id: 'title', title: 'title' },
            { id: 'quantity', title: 'quantity' }
        ],
        append: true
    });
    return csvWriter.writeRecords([order]);
}

 app.post('/purchase/:item_number', (req, res) => {
    const itemNumber = parseInt(req.params.item_number);
    const { title, quantity } = req.body;

    const book = catalog.find(book => book.id === itemNumber);

    if (book) {
        if (book.stock >= quantity) {
            book.stock -= quantity;

            const order = {
                order_id: Date.now().toString(),
                item_id: book.id,
                title: book.title,
                quantity: quantity
            };

            logOrder(order)
                .then(() => {
                    console.log(`Order logged successfully: ${quantity} copies of "${book.title}"`);

                    const csvWriter = createCsvWriter({
                        path: '../proj.csv',
                        header: [
                            { id: 'id', title: 'id' },
                            { id: 'title', title: 'title' },
                            { id: 'author', title: 'author' },
                            { id: 'topic', title: 'topic' },
                            { id: 'price', title: 'price' },
                            { id: 'stock', title: 'stock' }
                        ]
                    });

                    csvWriter.writeRecords(catalog)
                        .then(() => {
                            console.log('CSV file updated successfully');
                            res.json({ message: `Purchase successful: ${quantity} copies of "${book.title}"`, book });
                        })
                        .catch((error) => {
                            console.error('Error updating CSV file:', error);
                            res.status(500).send('Error updating CSV file');
                        });
                })
                .catch((error) => {
                    console.error('Error logging order:', error);
                    res.status(500).send('Error logging order');
                });
        } else {
            console.log('Not enough stock available');
            res.status(400).send('Not enough stock available');
        }
    } else {
        console.log('Book not found');
        res.status(404).send('Book not found');
    }
}); 



app.listen(PORT, () => {
    console.log(`Order service running on port ${PORT}`);
});