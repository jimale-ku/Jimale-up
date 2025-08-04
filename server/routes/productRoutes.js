// routes/productRoutes.js
const express = require('express')
const router  = express.Router()
const Product = require('../models/Product')
const productController = require('../controllers/productController');
const path = require('path'); // For path operations

// Add this function at the top
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// UPDATED: Now fetches from MongoDB using best practices
router.get('/', async (req, res) => {
  try {
    const { q, category, limit, offset } = req.query;
    const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/100?text=No+Image';

    // Build MongoDB query
    let mongoQuery = {};
    if (q) {
      mongoQuery.name = { $regex: q, $options: 'i' };
    }
    if (category) {
      mongoQuery.category = category;
    }

    // Parse pagination params
    const maxProducts = parseInt(limit) || 20;
    const skip = parseInt(offset) || 0;

    let products = [];

    // If no filters/search, use $sample for true random
    if (!q && !category) {
      products = await Product.aggregate([
        { $sample: { size: maxProducts + skip } }
      ]);
      // Apply skip after sampling, if needed
      products = products.slice(skip, skip + maxProducts);
    } else {
      // If filters/search, use find, then shuffle in code
      products = await Product.find(mongoQuery).lean();
      // Shuffle in code
      for (let i = products.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [products[i], products[j]] = [products[j], products[i]];
      }
      // Apply skip and limit
      products = products.slice(skip, skip + maxProducts);
    }

    // Ensure valid images using the same logic as Smart Suggestions
    const suggestionController = require('../controllers/suggestionController');
    products = products
      .map(p => ({
        ...p,
        img: suggestionController.getValidImage(p.img)
      }));

    console.log(`📦 Products API: ${products.length} products returned from MongoDB (${req.query.limit || 20} limit, ${req.query.offset || 0} offset)`);
    console.log(`🔍 Sample products:`, products.slice(0, 3).map(p => ({ 
      name: p.name, 
      hasImage: !!p.img, 
      imageType: p.img ? p.img.substring(0, 30) : 'none',
      isPlaceholder: p.img === 'https://via.placeholder.com/100'
    })));
    res.json(products);
  } catch (err) {
    console.error('❌ Products API Error:', err.message);
    res.status(500).json({ error: 'Failed to load products from MongoDB', details: err.message });
  }
});
// GET /api/products/:id
router.get('/:id', productController.getProductById);

// POST /api/products
router.post('/', async (req, res) => { /* ... */ })

// PATCH /api/products/:id
router.patch('/:id', async (req, res) => { /* ... */ })

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => { /* ... */ })

module.exports = router
