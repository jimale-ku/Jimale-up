// exportProductsWithIds.js
// Usage: node exportProductsWithIds.js

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';

const Product = require('../models/Product');

async function exportProducts() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    const products = await Product.find({}).lean();
    const outPath = path.resolve(__dirname, 'products_with_ids.json');
    fs.writeFileSync(outPath, JSON.stringify(products, null, 2));
    console.log(`Exported ${products.length} products to ${outPath}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Export failed:', err);
    process.exit(1);
  }
}

exportProducts(); 