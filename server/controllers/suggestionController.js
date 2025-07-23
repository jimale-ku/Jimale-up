const Product = require('../models/Product');
const List = require('../models/List');
const Item = require('../models/Item');
const Suggestion = require('../models/Suggestion');
const ProductHistory = require('../models/ProductHistory');
const UserFavorites = require('../models/UserFavorites');
const IntelligentFrequencyService = require('../services/intelligentFrequency');
const fs = require('fs');
const path = require('path');

// Simple cache for products.json
let productsCache = null;
let productsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get products from products.json with caching
function getProductsFromJson() {
  const now = Date.now();
  if (productsCache && (now - productsCacheTime) < CACHE_DURATION) {
    return productsCache;
  }
  
  try {
    const productsPath = path.resolve(__dirname, '../scripts/products.json');
    const data = fs.readFileSync(productsPath, 'utf-8');
    const products = JSON.parse(data);
    productsCache = products;
    productsCacheTime = now;
    return products;
  } catch (error) {
    console.error('Error reading products.json:', error);
    return [];
  }
}

// Helper to ensure a valid image URL
function getValidImage(img) {
  if (typeof img === 'string' && img.trim() && (img.startsWith('http') || img.startsWith('data:image/'))) {
    return img;
  }
  return 'https://via.placeholder.com/100';
}

// Get smart suggestions - SIMPLE VERSION
exports.getSmartSuggestions = async (req, res) => {
  try {
    const { type, limit = 20, groupId } = req.query;
    const limitNum = parseInt(limit, 10) || 20;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authe'
      });
    }

    let suggestions = [];

    // Get products from products.json
    const allProducts = getProductsFromJson();
    
    if (type === 'all') {
      // Return random products for ALL card (legacy: include name/img)
      const shuffled = allProducts.sort(() => Math.random() - 0.5);
      suggestions = shuffled.slice(0, limitNum).map(product => ({
        productId: product._id || product.productId,
        name: product.name || 'Unknown Product',
        img: getValidImage(product.img),
        barcode: product.barcode || '',
        type: 'all',
        score: 1,
        frequency: 1
      }));
    } else if (type === 'recent') {
      // Smart logic: get recent product IDs for the group
      const Group = require('../models/Group');
      const ProductHistory = require('../models/ProductHistory');
      const group = await Group.findById(groupId);
      if (!group) {
        // Fallback to random product IDs
        const shuffled = allProducts.sort(() => Math.random() - 0.5);
        suggestions = shuffled.slice(0, limitNum).map(product => ({
          productId: product._id || product.productId,
          barcode: product.barcode || '',
          type: 'recent'
        }));
      } else {
        const memberIds = group.members.map(m => m.user);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentPurchases = await ProductHistory.aggregate([
          { $match: {
            userId: { $in: memberIds },
            action: 'purchased',
            createdAt: { $gte: thirtyDaysAgo }
          }},
          { $sort: { createdAt: -1 } },
          { $group: {
            _id: '$productId',
            lastPurchase: { $first: '$createdAt' },
            timesPurchased: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
            lastBuyer: { $first: '$userId' }
          }},
          { $sort: { lastPurchase: -1 } },
          { $limit: limitNum }
        ]);
        if (recentPurchases.length === 0) {
          // Fallback: random products from products.json
          const shuffled = allProducts
            .filter(product => getValidImage(product.img) && product.img && product.img !== 'https://via.placeholder.com/100')
            .sort(() => Math.random() - 0.5);
          suggestions = shuffled.slice(0, 15).map(product => ({
            productId: product._id || product.productId || product.id,
            name: product.name || 'Unknown Product',
            img: getValidImage(product.img),
            barcode: product.barcode || '',
            type: 'recent'
          }));
        } else {
          // Map productId to full product details from allProducts
          suggestions = recentPurchases.map(item => {
            const product = allProducts.find(p => (
              p._id === item._id ||
              p.productId === item._id ||
              p.id === item._id
            ));
            return product && getValidImage(product.img) && product.img && product.img !== 'https://via.placeholder.com/100'
              ? {
                  productId: item._id,
                  name: product?.name || 'Unknown Product',
                  img: getValidImage(product?.img),
                  barcode: product?.barcode || '',
                  type: 'recent',
                  timesPurchased: item.timesPurchased,
                  totalQuantity: item.totalQuantity,
                  lastPurchaseDate: item.lastPurchase,
                  lastBuyer: item.lastBuyer
                }
              : null;
          }).filter(Boolean);
        }
      }
    } else if (type === 'favorite') {
      // Smart logic: get items from last 2 trips that are favorited by all group members
      const Group = require('../models/Group');
      const ProductHistory = require('../models/ProductHistory');
      const UserFavorites = require('../models/UserFavorites');
      const group = await Group.findById(groupId);
      if (!group) {
        // Fallback: random products from products.json
        const shuffled = allProducts
          .filter(product => getValidImage(product.img) && product.img && product.img !== 'https://via.placeholder.com/100')
          .sort(() => Math.random() - 0.5);
        suggestions = shuffled.slice(0, 15).map(product => ({
          productId: product._id || product.productId || product.id,
          name: product.name || 'Unknown Product',
          img: getValidImage(product.img),
          barcode: product.barcode || '',
          type: 'favorite'
        }));
      } else {
        const memberIds = group.members.map(m => m.user.toString());
        // Get last 2 trips (distinct purchase sessions by date)
        const recentPurchases = await ProductHistory.aggregate([
          { $match: {
            userId: { $in: memberIds },
            action: 'purchased'
          }},
          { $sort: { createdAt: -1 } },
          { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            products: { $push: '$productId' },
            createdAt: { $first: '$createdAt' }
          }},
          { $sort: { createdAt: -1 } },
          { $limit: 2 }
        ]);
        if (!recentPurchases.length) {
          // Fallback: random products from products.json
          const shuffled = allProducts
            .filter(product => getValidImage(product.img) && product.img && product.img !== 'https://via.placeholder.com/100')
            .sort(() => Math.random() - 0.5);
          suggestions = shuffled.slice(0, 15).map(product => ({
            productId: product._id || product.productId || product.id,
            name: product.name || 'Unknown Product',
            img: getValidImage(product.img),
            barcode: product.barcode || '',
            type: 'favorite'
          }));
        } else {
          // Flatten products from last 2 trips
          const productIds = [...new Set(recentPurchases.flatMap(trip => trip.products))];
          // For each product, check if all group members have favorited it
          const favoriteChecks = await Promise.all(productIds.map(async pid => {
            const favs = await UserFavorites.find({ productId: pid, userId: { $in: memberIds } });
            return { pid, count: favs.length };
          }));
          // Only include products favorited by all group members
          const qualifyingIds = favoriteChecks.filter(f => f.count === memberIds.length).map(f => f.pid);
          // Map to product details from products.json
          suggestions = qualifyingIds.map(pid => {
            const product = allProducts.find(p => (
              p._id === pid ||
              p.productId === pid ||
              p.id === pid
            ));
            return product && getValidImage(product.img) && product.img && product.img !== 'https://via.placeholder.com/100'
              ? {
                  productId: pid,
                  name: product?.name || 'Unknown Product',
                  img: getValidImage(product?.img),
                  barcode: product?.barcode || '',
                  type: 'favorite'
                }
              : null;
          }).filter(Boolean);
        }
      }
    } else if (type === 'frequent') {
      // Smart logic: show items purchased more than once by group members, sorted by frequency and recency
      const Group = require('../models/Group');
      const ProductHistory = require('../models/ProductHistory');
      const group = await Group.findById(groupId);
      if (!group) {
        // Fallback: random products from products.json
        const shuffled = allProducts
          .filter(product => getValidImage(product.img) && product.img && product.img !== 'https://via.placeholder.com/100')
          .sort(() => Math.random() - 0.5);
        suggestions = shuffled.slice(0, 15).map(product => ({
          productId: product._id || product.productId || product.id,
          name: product.name || 'Unknown Product',
          img: getValidImage(product.img),
          barcode: product.barcode || '',
          type: 'frequent'
        }));
      } else {
        const memberIds = group.members.map(m => m.user.toString());
        // Aggregate all purchases by group members
        const frequentPurchases = await ProductHistory.aggregate([
          { $match: {
            userId: { $in: memberIds },
            action: 'purchased'
          }},
          { $group: {
            _id: '$productId',
            timesPurchased: { $sum: 1 },
            lastPurchase: { $max: '$createdAt' },
            totalQuantity: { $sum: '$quantity' }
          }},
          { $match: { timesPurchased: { $gt: 1 } } }, // Only products bought more than once
          { $sort: { timesPurchased: -1, lastPurchase: -1 } },
          { $limit: limitNum }
        ]);
        if (!frequentPurchases.length) {
          // Fallback: random products from products.json
          const shuffled = allProducts
            .filter(product => getValidImage(product.img) && product.img && product.img !== 'https://via.placeholder.com/100')
            .sort(() => Math.random() - 0.5);
          suggestions = shuffled.slice(0, 15).map(product => ({
            productId: product._id || product.productId || product.id,
            name: product.name || 'Unknown Product',
            img: getValidImage(product.img),
            barcode: product.barcode || '',
            type: 'frequent'
          }));
        } else {
          suggestions = frequentPurchases.map(item => {
            const product = allProducts.find(p => (
              p._id === item._id ||
              p.productId === item._id ||
              p.id === item._id
            ));
            return product && getValidImage(product.img) && product.img && product.img !== 'https://via.placeholder.com/100'
              ? {
                  productId: item._id,
                  name: product?.name || 'Unknown Product',
                  img: getValidImage(product?.img),
                  barcode: product?.barcode || '',
                  type: 'frequent',
                  timesPurchased: item.timesPurchased,
                  totalQuantity: item.totalQuantity,
                  lastPurchase: item.lastPurchase
                }
              : null;
          }).filter(Boolean);
        }
      }
    } else {
      // Fallback: random product IDs
      const shuffled = allProducts.sort(() => Math.random() - 0.5);
      suggestions = shuffled.slice(0, limitNum).map(product => ({
        productId: product._id || product.productId,
        barcode: product.barcode || '',
        type: 'all'
      }));
    }

    res.json({
      success: true,
      suggestions: suggestions
    });

  } catch (error) {
    console.error('Error getting smart suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get smart suggestions'
    });
  }
};

// Fallback function for user-based suggestions (when no group available)
async function getUserBasedSuggestions(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;

    // Get user's recent and favorite products
    const [recentProducts, favoriteProducts, frequentProducts] = await Promise.all([
      getRecentlyAddedProducts(userId, Math.ceil(limit / 3)),
      getFavoriteProducts(userId, Math.ceil(limit / 3)),
      getBasicFrequentProducts(userId, Math.ceil(limit / 3))
    ]);

    const suggestions = [...recentProducts, ...favoriteProducts, ...frequentProducts];

    res.json({
      success: true,
      suggestions: suggestions.slice(0, limit)
    });

  } catch (error) {
    console.error('Error getting user-based suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user-based suggestions'
    });
  }
}

// Get household frequent products (BLAZING FAST: SmartCart-style simple aggregation)
async function getHouseholdFrequentProducts(groupId, limit) {
  try {
    // ULTRA FAST: Check cache first
    const cached = getCachedFrequent(groupId);
    if (cached) {
      return cached.slice(0, limit);
    }

    const Group = require('../models/Group');
    const ProductHistory = require('../models/ProductHistory');
    
    const group = await Group.findById(groupId);
    if (!group) return await getRandomProducts(limit);
    
    const memberIds = group.members.map(m => m.user);
    
    // ULTRA FAST: SmartCart-style aggregation - count purchases by frequency
    const frequentByTimes = await ProductHistory.aggregate([
      { $match: { 
        userId: { $in: memberIds },
        action: { $in: ['added', 'purchased'] }
      }},
      { $group: {
        _id: '$productId',
        timesPurchased: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        lastPurchase: { $max: '$createdAt' }
      }},
      { $sort: { timesPurchased: -1, totalQuantity: -1 } },
      { $limit: limit }
    ]);

    if (!frequentByTimes.length) {
      const fallback = await getRandomProducts(limit);
      setCachedFrequent(groupId, fallback);
      return fallback;
    }

    // SIMPLE FIX: Use products.json directly for guaranteed images
    const fs = require('fs');
    const path = require('path');
    const productsPath = path.resolve(__dirname, '../scripts/products.json');
    const data = fs.readFileSync(productsPath, 'utf-8');
    const allProducts = JSON.parse(data);

    // ULTRA FAST: Simple mapping with SmartCart-style data
    const results = frequentByTimes.map(item => {
      // Find product in products.json by ID or name
      const prod = allProducts.find(p => p._id === item._id || p.name === item._id);
      
      return {
        productId: item._id,
        name: prod?.name || 'Unknown Product',
        img: getValidImage(prod?.img),
        type: 'frequent',
        timesPurchased: item.timesPurchased,
        totalQuantity: item.totalQuantity,
        lastPurchase: item.lastPurchase,
        frequency: item.timesPurchased,
        score: item.timesPurchased * item.totalQuantity // SmartCart-style scoring
      };
    });

    // ULTRA FAST: Cache results
    setCachedFrequent(groupId, results);
    return results;

  } catch (error) {
    console.error('[frequent] Error:', error.message);
    return await getRandomProducts(limit);
  }
}

// Get all products (for ALL card) - fetch from Product collection in the database
async function getAllProducts(limit = 20) {
  try {
    // Use MongoDB $sample for true random fast batches, only return essential fields
    const products = await Product.aggregate([
      { $sample: { size: limit } },
      { $project: {
          _id: 1,
          name: 1,
          img: 1
      }}
    ]);
    
    // If MongoDB is empty, fallback to products.json
    if (!products.length) {
      const fs = require('fs');
      const path = require('path');
      const productsPath = path.resolve(__dirname, '../scripts/products.json');
      const data = fs.readFileSync(productsPath, 'utf-8');
      const allProducts = JSON.parse(data);
      
      return allProducts.slice(0, limit).map(product => ({
        productId: product._id || product.productId,
        name: product.name || 'Unknown Product',
        img: getValidImage(product.img),
        type: 'all',
        score: 1,
        frequency: 1
      }));
    }
    
    return products.map(product => ({
      productId: product._id,
      name: product.name || 'Unknown Product',
      img: getValidImage(product.img),
      type: 'all',
      score: 1,
      frequency: 1
    }));
  } catch (error) {
    // Fallback to products.json on any error
    try {
      const fs = require('fs');
      const path = require('path');
      const productsPath = path.resolve(__dirname, '../scripts/products.json');
      const data = fs.readFileSync(productsPath, 'utf-8');
      const allProducts = JSON.parse(data);
      
      return allProducts.slice(0, limit).map(product => ({
        productId: product._id || product.productId,
        name: product.name || 'Unknown Product',
        img: getValidImage(product.img),
        type: 'all',
        score: 1,
        frequency: 1
      }));
    } catch (fallbackError) {
      return [];
    }
  }
}

// Fallback function for basic frequency (when no intelligent data exists)
async function getBasicFrequentProducts(userId, limit) {
  try {
    const ProductHistory = require('../models/ProductHistory');
    const Product = require('../models/Product');

    // Get user's purchase history
    const purchaseHistory = await ProductHistory.find({
      userId,
      action: { $in: ['purchased', 'added'] }
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

    if (!purchaseHistory.length) {
      return await getRandomProducts(limit);
    }

    // Count frequency of each product
    const productCounts = {};
    purchaseHistory.forEach(record => {
      const productId = record.productId.toString();
      if (!productCounts[productId]) {
        productCounts[productId] = {
          count: 0,
          lastPurchase: record.createdAt
        };
      }
      productCounts[productId].count++;
    });

    // Sort by frequency and get top products
    const sortedProducts = Object.entries(productCounts)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, limit)
      .map(([productId, data]) => ({
        productId,
        frequency: data.count,
        lastPurchase: data.lastPurchase
      }));

    if (!sortedProducts.length) {
      return await getRandomProducts(limit);
    }

    // Get product details
    const productIds = sortedProducts.map(p => p.productId);
    const products = await Product.find({ 
      _id: { $in: productIds } 
    }).select('name img').lean();

    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    return sortedProducts.map(item => {
      const prod = productMap.get(item.productId);
      return {
        productId: item.productId,
        name: prod?.name || 'Unknown Product',
        img: getValidImage(prod?.img),
        type: 'frequent',
        frequency: item.frequency,
        lastPurchase: item.lastPurchase
      };
    });

  } catch (error) {
    console.error('Error getting basic frequent products:', error);
    return await getRandomProducts(limit);
  }
}

// Get recently added products for a user
async function getRecentlyAddedProducts(userId, limit) {
  try {
    const ProductHistory = require('../models/ProductHistory');
    const Product = require('../models/Product');

    const recentProducts = await ProductHistory.find({
      userId,
      action: { $in: ['added', 'purchased'] }
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

    if (!recentProducts.length) {
      return await getRandomProducts(limit);
    }

    // Get unique products
    const uniqueProducts = [];
    const seen = new Set();
    
    for (const record of recentProducts) {
      const productId = record.productId.toString();
      if (!seen.has(productId)) {
        seen.add(productId);
        uniqueProducts.push({
          productId,
          lastAdded: record.createdAt
        });
      }
    }

    // Get product details
    const productIds = uniqueProducts.map(p => p.productId);
    const products = await Product.find({ 
      _id: { $in: productIds } 
    }).select('name img').lean();

    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    return uniqueProducts.map(item => {
      const prod = productMap.get(item.productId);
      return {
        productId: item.productId,
        name: prod?.name || 'Unknown Product',
        img: getValidImage(prod?.img),
        type: 'recent',
        lastAdded: item.lastAdded
      };
    });

  } catch (error) {
    console.error('Error getting recently added products:', error);
    return await getRandomProducts(limit);
  }
}

// Get random products from the Product collection (FAST: MongoDB $sample)
async function getRandomProducts(limit) {
  try {
    // Use MongoDB $sample for true random fast sampling
    const products = await Product.aggregate([
      { $sample: { size: limit } },
      { $project: {
          _id: 1,
          name: 1,
          img: 1
      }}
    ]);
    
    // If MongoDB is empty, fallback to products.json
    if (!products.length) {
      const fs = require('fs');
      const path = require('path');
      const productsPath = path.resolve(__dirname, '../scripts/products.json');
      const data = fs.readFileSync(productsPath, 'utf-8');
      const allProducts = JSON.parse(data);
      
      // Shuffle and take random products
      const shuffled = allProducts.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, limit).map(product => ({
        productId: product._id || product.productId,
        name: product.name || 'Unknown Product',
        img: getValidImage(product.img),
        type: 'all',
        score: 1,
        frequency: 1
      }));
    }
    
    return products.map(product => ({
      productId: product._id,
      name: product.name || 'Unknown Product',
      img: getValidImage(product.img),
      type: 'all',
      score: 1,
      frequency: 1
    }));
  } catch (error) {
    console.error('Error getting random products:', error);
    // Fallback to products.json on any error
    try {
      const fs = require('fs');
      const path = require('path');
      const productsPath = path.resolve(__dirname, '../scripts/products.json');
      const data = fs.readFileSync(productsPath, 'utf-8');
      const allProducts = JSON.parse(data);
      
      // Shuffle and take random products
      const shuffled = allProducts.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, limit).map(product => ({
        productId: product._id || product.productId,
        name: product.name || 'Unknown Product',
        img: getValidImage(product.img),
        type: 'all',
        score: 1,
        frequency: 1
      }));
    } catch (fallbackError) {
      return [];
    }
  }
}

// Get user's favorite products
async function getFavoriteProducts(userId, limit) {
  try {
    const UserFavorites = require('../models/UserFavorites');
    const Product = require('../models/Product');

    const favoriteProducts = await UserFavorites.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit);

    if (!favoriteProducts.length) {
      return [];
    }

    // Get product details
    const productIds = favoriteProducts.map(fp => fp.productId);
    const products = await Product.find({ 
      _id: { $in: productIds } 
    }).select('name img').lean();

    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    return favoriteProducts.map(favorite => {
      const prod = productMap.get(favorite.productId);
      return {
        productId: favorite.productId,
        name: prod?.name || 'Unknown Product',
        img: getValidImage(prod?.img),
        type: 'favorite',
        isFavorited: true
      };
    });

  } catch (error) {
    console.error('Error getting favorite products:', error);
    return [];
  }
}

// Track product interaction for suggestions
exports.trackProductInteraction = async (req, res) => {
  try {
    const { productId, action, listId, groupId, quantity = 1, metadata = {} } = req.body;
    const userId = req.user.id;

    // Save product history with string productId
    const productHistory = new ProductHistory({
      userId,
      productId: productId, // Keep as string
      listId,
      action,
      quantity,
      metadata
    });

    await productHistory.save();

    // Update intelligent frequency tracking for household
    if (groupId) {
      try {
        await IntelligentFrequencyService.updateHouseholdFrequency(groupId, productId, action, userId, {
          listId,
          quantity,
          timestamp: new Date(),
          ...metadata
        });
      } catch (freqError) {
        console.error('Error updating household frequency tracking:', freqError);
        // Don't fail the request if frequency tracking fails
      }
    }

    res.json({
      success: true,
      message: 'Product interaction tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking product interaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track product interaction'
    });
  }
};

// Mark product as purchased (essential for intelligent frequency predictions)
exports.markAsPurchased = async (req, res) => {
  try {
    const { productId, listId, groupId, quantity = 1, price, store, metadata = {} } = req.body;
    const userId = req.user.id;

    // Save purchase history with string productId
    const productHistory = new ProductHistory({
      userId,
      productId: productId, // Keep as string
      listId,
      action: 'purchased',
      quantity,
      metadata: {
        ...metadata,
        purchasedAt: new Date(),
        price,
        store
      }
    });

    await productHistory.save();

    // Update intelligent frequency tracking for household
    if (groupId) {
      try {
        await IntelligentFrequencyService.updateHouseholdFrequency(groupId, productId, 'purchased', userId, {
          listId,
          quantity,
          price,
          store,
          timestamp: new Date(),
          ...metadata
        });
      } catch (freqError) {
        console.error('Error updating household frequency tracking for purchase:', freqError);
      }
    }

    res.json({
      success: true,
      message: 'Product marked as purchased successfully'
    });

  } catch (error) {
    console.error('Error marking product as purchased:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark product as purchased'
    });
  }
};

// Add product to favorites
exports.addToFavorites = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // Since we're using products.json, we need to handle string product IDs
    // We'll store the productId as a string in UserFavorites
    try {
      await UserFavorites.create({
        userId,
        productId: productId // Store as string, not ObjectId
      });

      res.json({
        success: true,
        message: 'Product added to favorites'
      });
    } catch (error) {
      if (error.code === 11000) {
        res.json({
          success: true,
          message: 'Product is already in favorites'
        });
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('Error adding to favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add to favorites'
    });
  }
};

// Remove product from favorites
exports.removeFromFavorites = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const result = await UserFavorites.deleteOne({
      userId,
      productId: productId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in favorites'
      });
    }

    res.json({
      success: true,
      message: 'Product removed from favorites'
    });

  } catch (error) {
    console.error('Error removing from favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove from favorites'
    });
  }
};

// Check if product is favorited
exports.checkFavoriteStatus = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const favorite = await UserFavorites.findOne({
      userId,
      productId: productId
    });

    res.json({
      success: true,
      isFavorited: !!favorite
    });

  } catch (error) {
    console.error('Error checking favorite status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check favorite status'
    });
  }
};

// ML Model Management (admin endpoints)
exports.trainMLModel = async (req, res) => {
  try {
    // For now, return a placeholder response
    // In a real implementation, this would trigger ML model training
    res.json({
      success: true,
      message: 'ML model training initiated (placeholder)',
      status: 'pending',
      estimatedTime: '5-10 minutes'
    });
  } catch (error) {
    console.error('Error training ML model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to train ML model'
    });
  }
};

exports.getFeatureImportance = async (req, res) => {
  try {
    // For now, return placeholder feature importance data
    // In a real implementation, this would return actual ML feature importance
    res.json({
      success: true,
      features: [
        { name: 'purchase_frequency', importance: 0.85 },
        { name: 'time_since_last_purchase', importance: 0.72 },
        { name: 'household_size', importance: 0.68 },
        { name: 'seasonal_patterns', importance: 0.54 },
        { name: 'price_sensitivity', importance: 0.48 }
      ],
      modelVersion: '1.0.0',
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting feature importance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feature importance'
    });
  }
}; 

// Get recent products for all group members (FAST: cached, indexed queries like SmartCart)
async function getGroupRecentlyAddedProducts(groupId, limit) {
  try {
    // FAST: Check cache first
    const cached = getCachedRecent(groupId);
    if (cached) {
      return cached.slice(0, limit);
    }

    const Group = require('../models/Group');
    const ProductHistory = require('../models/ProductHistory');
    
    const group = await Group.findById(groupId);
    if (!group) return await getRandomProducts(limit);
    
    const memberIds = group.members.map(m => m.user);
    
    // FAST: Simple indexed query - get recent purchases with product info in one query
    const recentPurchases = await ProductHistory.aggregate([
      { $match: { 
        userId: { $in: memberIds }, 
        action: 'purchased' 
      }},
      { $sort: { createdAt: -1 } },
      { $limit: limit * 3 }, // Get more to filter
      { $group: {
        _id: '$productId',
        lastPurchase: { $first: '$createdAt' },
        count: { $sum: 1 }
      }},
      { $sort: { lastPurchase: -1 } },
      { $limit: limit }
    ]);

    if (!recentPurchases.length) {
      const fallback = await getRandomProducts(limit);
      setCachedRecent(groupId, fallback);
      return fallback;
    }

    // SIMPLE FIX: Use products.json directly for guaranteed images
    const fs = require('fs');
    const path = require('path');
    const productsPath = path.resolve(__dirname, '../scripts/products.json');
    const data = fs.readFileSync(productsPath, 'utf-8');
    const allProducts = JSON.parse(data);

    // FAST: Return simple results immediately
    const results = recentPurchases.map(r => {
      // Find product in products.json by ID or name
      const prod = allProducts.find(p => p._id === r._id || p.name === r._id);
      return {
        productId: r._id,
        name: prod?.name || 'Unknown Product',
        img: getValidImage(prod?.img),
        type: 'recent',
        frequency: r.count || 1,
        lastPurchaseDate: r.lastPurchase
      };
    });

    // FAST: Cache results for next request
    setCachedRecent(groupId, results);
    return results;

  } catch (error) {
    console.error('[recent] Error:', error.message);
    return await getRandomProducts(limit);
  }
}

// Get favorite products for all group members (BLAZING FAST: minimal queries, direct lookups)
async function getGroupFavoriteProducts(groupId, limit) {
  try {
    // ULTRA FAST: Check cache first
    const cached = getCachedFavorites(groupId);
    if (cached) {
      return cached.slice(0, limit);
    }

    const Group = require('../models/Group');
    const ProductHistory = require('../models/ProductHistory');
    
    const group = await Group.findById(groupId);
    if (!group) return await getRandomProducts(limit);
    
    const memberIds = group.members.map(m => m.user);
    
    // ULTRA FAST: Simple query - just get recent interactions
    const recentInteractions = await ProductHistory.find({
      userId: { $in: memberIds },
      action: { $in: ['favorited', 'added', 'purchased'] }
    })
    .sort({ createdAt: -1 })
    .limit(limit * 2) // Get more to filter
    .lean(); // Ultra fast - no mongoose overhead

    if (!recentInteractions.length) {
      const fallback = await getRandomProducts(limit);
      setCachedFavorites(groupId, fallback);
      return fallback;
    }

    // ULTRA FAST: Get unique product IDs
    const productIds = [...new Set(recentInteractions.map(r => r.productId.toString()))].slice(0, limit);
    
    // SIMPLE FIX: Use products.json directly for guaranteed images
    const fs = require('fs');
    const path = require('path');
    const productsPath = path.resolve(__dirname, '../scripts/products.json');
    const data = fs.readFileSync(productsPath, 'utf-8');
    const allProducts = JSON.parse(data);

    // ULTRA FAST: Simple mapping with minimal processing
    const results = productIds.map(productId => {
      // Find product in products.json by ID or name
      const prod = allProducts.find(p => p._id === productId || p.name === productId);
      const interactions = recentInteractions.filter(r => r.productId.toString() === productId);
      
      return {
        productId: productId,
        name: prod?.name || 'Unknown Product',
        img: getValidImage(prod?.img),
        type: 'favorite',
        totalInteractions: interactions.length,
        lastInteraction: interactions[0]?.createdAt,
        isFavorited: interactions.some(i => i.action === 'favorited'),
        isPurchased: interactions.some(i => i.action === 'purchased'),
        isAdded: interactions.some(i => i.action === 'added'),
        frequency: interactions.length
      };
    });

    // ULTRA FAST: Cache results
    setCachedFavorites(groupId, results);
    return results;

  } catch (error) {
    console.error('[favorite] Error:', error.message);
    return await getRandomProducts(limit);
  }
} 