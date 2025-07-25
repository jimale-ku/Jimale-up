// routes/productRoutes.js
const express = require('express')
const router  = express.Router()
const Product = require('../models/Product')
const productController = require('../controllers/productController');
const fs = require('fs'); // Added for reading products.json
const path = require('path'); // For resolving the path to products.json

// Add this function at the top
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/*
// UPDATED: Now fetches from MongoDB using best practices. Old file-based code is commented below for easy revert.
// router.get('/', async (req, res) => {
//   try {
//     const { q, category, limit, offset } = req.query;
//     const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/100?text=No+Image';
//
//     // Build MongoDB query
//     let mongoQuery = {};
//     if (q) {
//       mongoQuery.name = { $regex: q, $options: 'i' };
//     }
//     if (category) {
//       mongoQuery.category = category;
//     }
//
//     // Parse pagination params
//     const maxProducts = parseInt(limit) || 20;
//     const skip = parseInt(offset) || 0;
//
//     let products = [];
//
//     // If no filters/search, use $sample for true random
//     if (!q && !category) {
//       products = await Product.aggregate([
//         { $sample: { size: maxProducts + skip } }
//       ]);
//       // Apply skip after sampling, if needed
//       products = products.slice(skip, skip + maxProducts);
//     } else {
//       // If filters/search, use find, then shuffle in code
//       products = await Product.find(mongoQuery).lean();
//       // Shuffle in code
//       for (let i = products.length - 1; i > 0; i--) {
//         const j = Math.floor(Math.random() * (i + 1));
//         [products[i], products[j]] = [products[j], products[i]];
//       }
//       // Apply skip and limit
//       products = products.slice(skip, skip + maxProducts);
//     }
//
//     // Ensure valid images
//     products = products
//       .map(p => ({
//         ...p,
//         img: p.img && typeof p.img === 'string' && p.img.trim() !== '' ? p.img : PLACEHOLDER_IMAGE
//       }))
//       .filter(p => p.img && (p.img.startsWith('http') || p.img.startsWith('data:image/')) && p.img !== PLACEHOLDER_IMAGE);
//
//     res.json(products);
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to load products', details: err.message });
//   }
// });
*/
// OLD CODE: Serve products from products.json instead of MongoDB for setup/testing
router.get('/', async (req, res) => {
    try {
        // Path to the products.json file
        const productsPath = path.resolve(__dirname, '../scripts/products.json');
        // Read and parse the JSON file (sync for simplicity in this temp setup)
        const data = fs.readFileSync(productsPath, 'utf-8');
        let products = JSON.parse(data);

        // Apply filters if present
        const { q, category, limit, offset } = req.query;
        if (q) {
            const regex = new RegExp(q, 'i');
            products = products.filter(p => regex.test(p.name));
        }
        if (category) {
            products = products.filter(p => p.category === category);
        }
        // Shuffle products for random order
        shuffleArray(products);
        
        // Apply offset and limit for pagination
        let maxProducts = 20;
        if (limit) {
            maxProducts = parseInt(limit);
        }
        let start = 0;
        if (offset) {
            start = parseInt(offset);
        }
        // Ensure every product has an img property and filter for valid images
        const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/100?text=No+Image';
        products = products
            .map(p => ({
                ...p,
                img: p.img && typeof p.img === 'string' && p.img.trim() !== '' ? p.img : PLACEHOLDER_IMAGE
            }))
            .filter(p => p.img && (p.img.startsWith('http') || p.img.startsWith('data:image/')) && p.img !== PLACEHOLDER_IMAGE);
        products = products.slice(start, start + maxProducts);
        res.json(products);
    } catch (err) {
        // If there's an error reading/parsing the file, return a 500 error
        res.status(500).json({ error: 'Failed to load products for testing', details: err.message });
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
