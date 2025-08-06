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

    // OPTIMIZED: Better sampling strategy for performance
    if (!q && !category) {
      // Use more efficient sampling for small datasets
      const totalCount = await Product.countDocuments();
      
      if (totalCount <= maxProducts + skip) {
        // If we need most/all products, just get them all
        products = await Product.find().lean();
        shuffleArray(products);
        products = products.slice(skip, skip + maxProducts);
      } else {
        // Use aggregation for larger datasets
        products = await Product.aggregate([
          { $sample: { size: Math.min(maxProducts + skip, totalCount) } }
        ]);
        products = products.slice(skip, skip + maxProducts);
      }
    } else {
      // If filters/search, use find, then shuffle in code
      products = await Product.find(mongoQuery).lean();
      shuffleArray(products);
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

// POST /api/products/batch - OPTIMIZED for performance
router.post('/batch', async (req, res) => {
  try {
    const { productIds } = req.body;
    
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'productIds array is required' });
    }
    
    // Limit to prevent abuse
    const limitedIds = productIds.slice(0, 50);
    
    const products = await Product.find({ 
      _id: { $in: limitedIds } 
    }).select('name img barcode category price').lean();
    
    console.log(`📦 Batch API: ${products.length} products returned for ${limitedIds.length} requested IDs`);
    
    res.json(products);
  } catch (err) {
    console.error('❌ Batch Products API Error:', err.message);
    res.status(500).json({ error: 'Failed to load products batch', details: err.message });
  }
});

// POST /api/products
router.post('/', async (req, res) => { /* ... */ })

// PATCH /api/products/:id
router.patch('/:id', async (req, res) => { /* ... */ })

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => { /* ... */ })

module.exports = router
