// scripts/importProducts.js
const mongoose = require('mongoose');
const Product = require('../models/Product');
const products = require('./products.json');

const MONGO_URI = 'mongodb+srv://jimale-22031:Allah%4022031@jimale.ky7k0mp.mongodb.net/?retryWrites=true&w=majority&appName=jimale';

async function importProducts() {
  await mongoose.connect(MONGO_URI);

  // Optional: clear existing products for a clean demo
  await Product.deleteMany({});

  // Insert a subset (e.g., first 20) for demo
  const demoProducts = products.slice(0, 20).map(p => ({
    _id: p._id,
              name: p.name,
              barcode: p.barcode,
              img: p.img,
    count: p.count
  }));

  await Product.insertMany(demoProducts);

  console.log('Demo products imported!');
  process.exit();
}

importProducts();
