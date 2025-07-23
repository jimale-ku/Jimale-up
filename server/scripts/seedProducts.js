// server/scripts/seedProducts.js
require('dotenv').config();
const mongoose = require('mongoose');
const Product  = require('../models/Product');
const data     = require('./products.json');  
// products.json is an array of { name, iconUrl, category }

;(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🗑 Clearing products…');
  // Map iconUrl to img for each product, use placeholder if missing or null
  const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/100?text=No+Image';
  const getValidImg = (img, iconUrl) => {
    if (img && typeof img === 'string' && img.trim() !== '') return img;
    if (iconUrl && typeof iconUrl === 'string' && iconUrl.trim() !== '') return iconUrl;
    return PLACEHOLDER_IMAGE;
  };
  const productsWithImg = data.map(p => ({
    ...p,
    img: getValidImg(p.img, p.iconUrl),
  }));
  await Product.deleteMany({});
  console.log(`📥 Inserting ${productsWithImg.length} products…`);
  await Product.insertMany(productsWithImg);
  console.log('✅ Done.');
  process.exit();
})();
