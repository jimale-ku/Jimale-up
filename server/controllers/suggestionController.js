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

    if (type === 'all') {
      // Use MongoDB instead of old products.json for ALL card
      console.log('🔄 ALL card: Fetching from MongoDB...');
      const products = await Product.aggregate([
        { $sample: { size: limitNum } },
        { $project: {
            _id: 1,
            name: 1,
            img: 1,
            barcode: 1
        }}
      ]);
      
      console.log(`📦 ALL card: Found ${products.length} products from MongoDB`);
      console.log('🔍 ALL card sample products:', products.slice(0, 3).map(p => ({ 
        name: p.name, 
        hasImage: !!p.img, 
        imageType: p.img ? p.img.substring(0, 30) : 'none' 
      })));
      
      suggestions = products.map(product => ({
        productId: product._id,
        name: product.name || 'Unknown Product',
        img: getValidImage(product.img),
        barcode: product.barcode || '',
        type: 'all',
        score: 1,
        frequency: 1
      }));
    } else if (type === 'recent') {
      // RECENT: Show items from the most recent completed trip (same as LAST BOUGHT tab)
      const Group = require('../models/Group');
      const PurchaseHistory = require('../models/PurchaseHistory');
      const group = await Group.findById(groupId);
      if (!group) {
        suggestions = []; // Return empty if no group
      } else {
        // Get the most recent trip timestamp for this group
        const lastTrip = await PurchaseHistory.find({ group: groupId })
          .sort({ boughtAt: -1 })
          .limit(1);
        
        if (lastTrip.length === 0) {
          // No trips yet - return empty
          suggestions = [];
        } else {
          // Get all items from the most recent trip (same boughtAt timestamp)
          const lastBoughtAt = lastTrip[0].boughtAt;
          const lastTripItems = await PurchaseHistory.find({ 
            group: groupId, 
            boughtAt: lastBoughtAt 
          }).sort({ createdAt: -1 });
          
          // Map to product details from MongoDB
          const productIds = lastTripItems.map(item => item.product).filter(Boolean);
          const products = await Product.find({ _id: { $in: productIds } }).select('name img barcode').lean();
          const productMap = new Map(products.map(p => [p._id.toString(), p]));
          
          suggestions = lastTripItems.map(item => {
            const product = productMap.get(item.product?.toString());
            return product && getValidImage(product.img) && product.img && product.img !== 'https://via.placeholder.com/100'
              ? {
                  productId: item.product || product._id,
                  name: item.name || product?.name || 'Unknown Product',
                  img: getValidImage(product?.img) || item.img || '',
                  barcode: product?.barcode || '',
                  type: 'recent',
                  quantity: item.quantity || 1,
                  boughtAt: item.boughtAt,
                  tripDate: new Date(item.boughtAt).toLocaleDateString()
                }
              : null;
          }).filter(Boolean);
        }
      }
    } else if (type === 'favorite') {
      const Group = require('../models/Group');
      const group = await Group.findById(groupId);
      if (!group) {
          // Fallback: random products from MongoDB
          const products = await Product.aggregate([
            { $sample: { size: 15 } },
            { $project: {
                _id: 1,
                name: 1,
                img: 1,
                barcode: 1
            }}
          ]);
          suggestions = products.map(product => ({
            productId: product._id,
            name: product.name || 'Unknown Product',
            img: getValidImage(product.img),
            barcode: product.barcode || '',
            type: 'favorite'
          }));
        } else {
        const memberIds = group.members.map(m => m.user.toString());
        // Get all favorites for this group by any member
        const groupFavorites = await UserFavorites.find({
          groupId,
          userId: { $in: memberIds }
        }).lean();
        // Get unique productIds
        const uniqueProductIds = [...new Set(groupFavorites.map(fav => fav.productId))];
        // Map to product details from MongoDB
        const products = await Product.find({ _id: { $in: uniqueProductIds } }).select('name img barcode').lean();
        const productMap = new Map(products.map(p => [p._id.toString(), p]));
        
        suggestions = uniqueProductIds.map(pid => {
            const product = productMap.get(pid);
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
    } else if (type === 'frequent') {
      // FREQUENT: Show most frequently bought items in the last 5 trips, boosted by favorite count
      const Group = require('../models/Group');
      const PurchaseHistory = require('../models/PurchaseHistory');
      const UserFavorites = require('../models/UserFavorites');
      const group = await Group.findById(groupId);
      if (!group) {
        suggestions = [];
      } else {
        // 1. Get last 5 trips (unique boughtAt timestamps)
        const lastTrips = await PurchaseHistory.find({ group: groupId })
          .sort({ boughtAt: -1 })
          .distinct('boughtAt');
        const last5Trips = lastTrips.slice(0, 5);
        if (last5Trips.length === 0) {
          suggestions = [];
        } else {
          // 2. Get all items from those trips
          const tripItems = await PurchaseHistory.find({ group: groupId, boughtAt: { $in: last5Trips } });
          // 3. Count frequency for each product (by trip)
          const freqMap = {};
          const tripMap = {};
          tripItems.forEach(item => {
            const key = item.product?.toString() || item.name;
            if (!freqMap[key]) {
              freqMap[key] = { count: 0, lastBought: item.boughtAt, name: item.name, product: item.product, img: item.img, quantity: 0, tripSet: new Set() };
            }
            freqMap[key].count += 1;
            freqMap[key].quantity += item.quantity || 1;
            freqMap[key].tripSet.add(item.boughtAt.toISOString());
            if (item.boughtAt > freqMap[key].lastBought) freqMap[key].lastBought = item.boughtAt;
          });
          // 4. Get favorite counts for each product in this group
        const memberIds = group.members.map(m => m.user.toString());
          const favs = await UserFavorites.find({ groupId, userId: { $in: memberIds } });
          const favMap = {};
          favs.forEach(fav => {
            favMap[fav.productId] = (favMap[fav.productId] || 0) + 1;
          });
          // 5. Filter and map to product details
          let filtered = Object.entries(freqMap).filter(([key, val]) => {
            if (last5Trips.length === 1) {
              // Only one trip: show items with quantity > 1
              return val.quantity > 1;
        } else {
              // Multiple trips: show items bought in more than one trip
              return val.tripSet.size > 1;
            }
          });
          suggestions = filtered.map(([key, val]) => {
            const product = allProducts.find(p => (
              p._id?.toString() === val.product?.toString() ||
              p.productId?.toString() === val.product?.toString() ||
              p.id?.toString() === val.product?.toString() ||
              p.name === val.name
            ));
            const favoriteCount = favMap[val.product?.toString()] || 0;
            return product && getValidImage(product.img) && product.img && product.img !== 'https://via.placeholder.com/100'
              ? {
                  productId: val.product || product._id || product.productId,
                  name: val.name || product?.name || 'Unknown Product',
                  img: getValidImage(product?.img) || val.img || '',
                  barcode: product?.barcode || '',
                  type: 'frequent',
                  frequency: val.count,
                  quantity: val.quantity,
                  lastBought: val.lastBought,
                  favoriteCount,
                }
              : null;
          }).filter(Boolean)
            .sort((a, b) => {
              // Sort by frequency desc, then favoriteCount desc, then lastBought desc
              if (b.frequency !== a.frequency) return b.frequency - a.frequency;
              if (b.favoriteCount !== a.favoriteCount) return b.favoriteCount - a.favoriteCount;
              return new Date(b.lastBought) - new Date(a.lastBought);
            })
            .slice(0, 10);
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

    // Get product details from MongoDB instead of old products.json
    const productIds = frequentByTimes.map(item => item._id);
    const products = await Product.find({ _id: { $in: productIds } }).select('name img').lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // ULTRA FAST: Simple mapping with SmartCart-style data
    const results = frequentByTimes.map(item => {
      const prod = productMap.get(item._id.toString());
      
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
    
    // Return empty array if no products found (no fallback to old file)
    if (!products.length) {
      console.log('⚠️ No products found in MongoDB for ALL card');
      return [];
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
    console.error('❌ Error getting all products from MongoDB:', error);
    // Return empty array instead of falling back to old file
    return [];
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
    
    // Return empty array if no products found (no fallback to old file)
    if (!products.length) {
      console.log('⚠️ No products found in MongoDB for random products');
      return [];
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
    console.error('❌ Error getting random products from MongoDB:', error);
    // Return empty array instead of falling back to old file
    return [];
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
    const { productId, groupId } = req.body;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }
    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    try {
      await UserFavorites.create({
        userId,
        groupId,
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
    const { productId, groupId } = req.body;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }
    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    const result = await UserFavorites.deleteOne({
      userId,
      groupId,
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
    const { groupId } = req.query;
    const userId = req.user.id;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }
    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    const favorite = await UserFavorites.findOne({
      userId,
      groupId,
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

    // Get product details from MongoDB instead of old products.json
    const productIds = recentPurchases.map(r => r._id);
    const products = await Product.find({ _id: { $in: productIds } }).select('name img').lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // FAST: Return simple results immediately
    const results = recentPurchases.map(r => {
      const prod = productMap.get(r._id.toString());
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
    
    // Get product details from MongoDB instead of old products.json
    const products = await Product.find({ _id: { $in: productIds } }).select('name img').lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    // ULTRA FAST: Simple mapping with minimal processing
    const results = productIds.map(productId => {
      const prod = productMap.get(productId);
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

// Export getValidImage function for use in other modules
module.exports = {
  getSmartSuggestions: exports.getSmartSuggestions,
  getValidImage
}; 