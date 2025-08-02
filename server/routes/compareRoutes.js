// server/routes/compareRoutes.js
const express = require('express');
const router = express.Router();
const List = require('../models/List');
const axios = require('axios');
const cheerio = require('cheerio');
const StorePriceCache = require('../models/StorePriceCache');
const { getDistances } = require('../services/distance');

// Add in-memory cache for better performance
const priceCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

// Rate limiting to prevent overwhelming the external API
const requestQueue = [];
let isProcessing = false;
const MAX_CONCURRENT_REQUESTS = 3;
let activeRequests = 0;

// Rate limiter function
async function rateLimitedRequest(url, params, headers) {
  return new Promise((resolve, reject) => {
    const request = { url, params, headers, resolve, reject };
    requestQueue.push(request);
    processQueue();
  });
}

async function processQueue() {
  if (isProcessing || activeRequests >= MAX_CONCURRENT_REQUESTS) {
    return;
  }
  
  isProcessing = true;
  
  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
    const request = requestQueue.shift();
    activeRequests++;
    
    try {
      const response = await fetchWithRetry(request.url, request.params, request.headers);
      request.resolve(response);
    } catch (error) {
      request.reject(error);
    } finally {
      activeRequests--;
      // Small delay between requests to be respectful to the external API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  isProcessing = false;
  
  // If there are still items in the queue, process them
  if (requestQueue.length > 0) {
    setTimeout(processQueue, 100);
  }
}

// Cache management functions
function getCacheKey(city, searchTerm) {
  return `${city}:${searchTerm}`;
}

function getFromCache(city, searchTerm) {
  const key = getCacheKey(city, searchTerm);
  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[CACHE] Hit for ${searchTerm} in ${city}`);
    return cached.data;
  }
  return null;
}

function setCache(city, searchTerm, data) {
  const key = getCacheKey(city, searchTerm);
  priceCache.set(key, {
    data,
    timestamp: Date.now()
  });
  console.log(`[CACHE] Set for ${searchTerm} in ${city}`);
}

// Clean old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of priceCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      priceCache.delete(key);
    }
  }
}, CACHE_TTL);

async function fetchWithRetry(url, params, headers, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DEBUG] Attempt ${attempt}/${maxRetries} for URL:`, url);
      
      const response = await axios.get(url, { 
        params, 
        headers,
        timeout: 5000 // Reduced from 10s to 5s
      });
      
      return response;
    } catch (error) {
      console.error(`[DEBUG] Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Reduced delay between retries
      const delay = Math.pow(1.5, attempt) * 500; // 750ms, 1125ms instead of 2s, 4s
      console.log(`[DEBUG] Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function fetchCompare(locationCity, searchTerm) {
  const streetId = 9000;
  const cityId = 0;
  const url = 'https://chp.co.il/main_page/compare_results';
  let allResults = []; // Local variable to accumulate results
  
  // Check cache first
  const cached = getFromCache(locationCity, searchTerm);
  if (cached) {
    return cached;
  }
  
  // Optimized search strategies - reduced from 7+ to 3-4 strategies
  const searchStrategies = [];
  
  // Strategy 1: Original search term (barcode or name)
  searchStrategies.push(searchTerm);
  
  // Strategy 2: Enhanced barcode handling - simplified
  if (/^\d+$/.test(searchTerm)) {
    if (searchTerm.length < 13) {
      // Only try the most common padding
      searchStrategies.push(searchTerm.padStart(13, '0'));
    }
    
    // Strategy 3: If it's a barcode, try without leading zeros
    if (searchTerm.length === 13 && searchTerm.startsWith('0')) {
      const trimmedBarcode = searchTerm.replace(/^0+/, '');
      searchStrategies.push(trimmedBarcode);
    }
  }
  
  // Strategy 4: Enhanced name variations - simplified
  if (!/^\d+$/.test(searchTerm)) {
    // Remove common suffixes like "800פג" from "תירס 800פג"
    const cleanName = searchTerm.replace(/\s+\d+.*$/, '').trim();
    if (cleanName !== searchTerm && cleanName.length >= 3) {
      searchStrategies.push(cleanName);
    }
    
    // Try brand name only (first word) - most effective strategy
    const words = searchTerm.split(' ');
    if (words.length > 1) {
      const brandName = words[0];
      if (brandName.length >= 2) {
        searchStrategies.push(brandName);
      }
    }
  }
  
  console.log('[DEBUG] Optimized search strategies for:', searchTerm, ':', searchStrategies);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
    'Referer': 'https://chp.co.il/'
  };

  // Try each search strategy with early exit
  for (const strategy of searchStrategies) {
    try {
      const params = {
        shopping_address: locationCity,
        shopping_address_street_id: streetId,
        shopping_address_city_id: cityId,
        product_barcode: strategy,
        from: 0,
        num_results: 30,
      };
      
      console.log('[DEBUG] Trying search strategy:', strategy);
      
      const response = await rateLimitedRequest(url, params, headers);
      const { data: html } = response;
      
      // ENHANCED DEBUGGING: Check if we got a valid response
      console.log(`[DEBUG] HTML response length for ${searchTerm}:`, html.length);
      console.log(`[DEBUG] HTML contains 'results-table':`, html.includes('results-table'));
      console.log(`[DEBUG] HTML contains 'no results':`, html.includes('no results') || html.includes('לא נמצאו תוצאות'));
      
      const $ = cheerio.load(html);
      const results = {};

      // Check if results table exists
      const resultsTable = $('.results-table tbody tr');
      console.log(`[DEBUG] Found ${resultsTable.length} table rows for ${searchTerm}`);
      
      if (resultsTable.length === 0) {
        console.log(`[DEBUG] No results table found for ${searchTerm}. Checking for error messages...`);
        const errorMessages = $('body').text().match(/לא נמצאו תוצאות|no results|error|שגיאה/gi);
        if (errorMessages) {
          console.log(`[DEBUG] Error messages found:`, errorMessages);
        }
        continue; // Try next strategy
      }

      // Updated selector for results-table
      resultsTable.each((i, row) => {
        const $row = $(row);
        const branch = $row.find('td:nth-child(1)').text().trim();
        const address = $row.find('td:nth-child(2)').text().trim();
        const priceText = $row.find('td:nth-child(3)').text().trim();
        const quantityText = $row.find('td:nth-child(4)').text().trim();
        
        if (branch && address && priceText) {
          const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
          const quantity = parseInt(quantityText.replace(/[^\d]/g, '')) || 1;
          
          if (!isNaN(price) && price > 0) {
            if (!results[branch]) {
              results[branch] = {
                branch,
                address,
                totalPrice: 0,
                itemsFound: 0,
                itemPrices: {},
                productDetails: {}
              };
            }
            
            results[branch].totalPrice += price;
            results[branch].itemsFound += 1;
            results[branch].itemPrices[searchTerm] = price;
            results[branch].productDetails[searchTerm] = {
              name: searchTerm,
              price: price,
              quantity: quantity
            };
          }
        }
      });
      
      // If we found results, add them and potentially exit early
      if (Object.keys(results).length > 0) {
        allResults = Object.values(results);
        console.log(`[DEBUG] Found ${allResults.length} stores for ${searchTerm} with strategy: ${strategy}`);
        
        // Early exit: if we have good results, don't try more strategies
        if (allResults.length >= 2) {
          console.log(`[DEBUG] Early exit for ${searchTerm} - found ${allResults.length} stores`);
          break;
        }
      }
      
    } catch (error) {
      console.error(`[DEBUG] Error with strategy ${strategy}:`, error.message);
      continue; // Try next strategy
    }
  }
  
  // Cache the results
  setCache(locationCity, searchTerm, allResults);
  
  return allResults;
}

// Enhanced product search with fallback
async function searchProductWithFallback(city, product) {
  console.log(`[DEBUG] Searching for product:`, product.barcode, product.name);
  
  // Try scraping first
  let prodResults = await fetchCompare(city, product.barcode);
  
  // If no results found by barcode, try by name
  if (!prodResults || prodResults.length === 0) {
    console.log(`[DEBUG] No results for barcode ${product.barcode}, trying name search`);
    if (product.name) {
      prodResults = await fetchCompare(city, product.name);
    }
  }
  
  // If still no results, use fallback
  if (!prodResults || prodResults.length === 0) {
    console.log(`[DEBUG] No scraping results, using fallback for ${product.name}`);
    const fallbackPrice = await getFallbackPrice(product.name, product.barcode);
    
    // Create a fallback result with estimated price
    prodResults = [{
      branch: 'מחיר משוער',
      address: 'לא זמין באזור זה',
      totalPrice: fallbackPrice.toFixed(2),
      itemsFound: 1,
      itemPrices: { [product.barcode]: fallbackPrice },
      isFallback: true // Flag to indicate this is estimated
    }];
  }
  
  return prodResults;
}

// Enhanced fallback price estimation with better categorization
async function getFallbackPrice(productName, barcode) {
  // Enhanced category estimates with more realistic price ranges
  const categoryEstimates = {
    'bread': { min: 8, max: 18, avg: 12 },
    'milk': { min: 5, max: 15, avg: 9 },
    'cheese': { min: 12, max: 45, avg: 25 },
    'meat': { min: 25, max: 120, avg: 60 },
    'vegetables': { min: 3, max: 20, avg: 8 },
    'fruits': { min: 5, max: 35, avg: 15 },
    'cereal': { min: 10, max: 30, avg: 18 },
    'snacks': { min: 6, max: 25, avg: 12 },
    'beverages': { min: 4, max: 20, avg: 10 },
    'cleaning': { min: 8, max: 35, avg: 18 },
    'personal_care': { min: 6, max: 30, avg: 15 },
    'wine': { min: 25, max: 80, avg: 45 },
    'chips': { min: 2, max: 8, avg: 4 },
    'juice': { min: 8, max: 25, avg: 15 },
    'general': { min: 8, max: 25, avg: 15 }
  };
  
  // Enhanced keyword matching for better category detection
  const name = (productName || '').toLowerCase();
  let category = 'general';
  
  // More specific category detection
  if (name.includes('לחם') || name.includes('bread') || name.includes('בייגל')) category = 'bread';
  else if (name.includes('חלב') || name.includes('milk') || name.includes('יוגורט')) category = 'milk';
  else if (name.includes('גבינה') || name.includes('cheese') || name.includes('קוטג')) category = 'cheese';
  else if (name.includes('בשר') || name.includes('meat') || name.includes('עוף') || name.includes('דג')) category = 'meat';
  else if (name.includes('ירקות') || name.includes('vegetables') || name.includes('עגבניה') || name.includes('מלפפון')) category = 'vegetables';
  else if (name.includes('פירות') || name.includes('fruits') || name.includes('תפוח') || name.includes('בננה')) category = 'fruits';
  else if (name.includes('דגנים') || name.includes('cereal') || name.includes('קורנפלקס')) category = 'cereal';
  else if (name.includes('חטיף') || name.includes('snack') || name.includes('ביסלי') || name.includes('קראנצ')) category = 'snacks';
  else if (name.includes('משקה') || name.includes('drink') || name.includes('קולה') || name.includes('ספרייט')) category = 'beverages';
  else if (name.includes('ניקוי') || name.includes('cleaning') || name.includes('אקונומיקה') || name.includes('סבון')) category = 'cleaning';
  else if (name.includes('טיפוח') || name.includes('care') || name.includes('שמפו') || name.includes('משחת')) category = 'personal_care';
  else if (name.includes('יין') || name.includes('wine') || name.includes('סוביניון') || name.includes('קברנה')) category = 'wine';
  else if (name.includes('ציפס') || name.includes('chips') || name.includes('קראנצ')) category = 'chips';
  else if (name.includes('מיץ') || name.includes('juice') || name.includes('ויטמינצ')) category = 'juice';
  
  const estimate = categoryEstimates[category] || categoryEstimates.general;
  
  // Use average price with small random variation (±15%)
  const variation = 0.85 + (Math.random() * 0.3); // 0.85 to 1.15
  const estimatedPrice = Math.round(estimate.avg * variation * 10) / 10;
  
  console.log(`[DEBUG] Fallback price for ${productName}: ${estimatedPrice} ILS (category: ${category}, avg: ${estimate.avg})`);
  
  return estimatedPrice;
}

function calculateProductTotal(quantity, regularPrice, salePrice, requiredQuantity) {
  if (!salePrice || !requiredQuantity || quantity < requiredQuantity) {
    return (regularPrice || 0) * quantity;
  }
  const numSaleGroups = Math.floor(quantity / requiredQuantity);
  const saleUnits = numSaleGroups * requiredQuantity;
  const regularUnits = quantity - saleUnits;
  return (numSaleGroups * salePrice * requiredQuantity) + (regularUnits * (regularPrice || 0));
}

// GET version
router.get('/:listId', async (req, res) => {
  try {
    const { listId } = req.params;
    const locationCity = req.query.location;
    const list = await List.findById(listId).populate('items.product').lean();

    if (!list) return res.status(404).json({ error: 'List not found' });
    const barcodes = list.items.map(i => i.product?.barcode).filter(Boolean);
    if (barcodes.length === 0) return res.status(400).json({ error: 'No barcodes' });

    const results = await fetchCompare(locationCity, barcodes);
    res.json(results);
  } catch (err) {
    console.error('[compare GET] error', err);
    res.status(500).json({ error: err.message });
  }
});

// POST version
router.post('/', async (req, res) => {
  try {
    const { city, barcodes } = req.body;
    if (!city || !Array.isArray(barcodes) || barcodes.length === 0) {
      return res.status(400).json({ error: 'Missing city or barcodes array' });
    }
    const results = await fetchCompare(city, barcodes);
    res.json(results);
  } catch (err) {
    console.error('[compare POST] error', err);
    res.status(500).json({ error: err.message });
  }
});

// MILESTONE 4: POST /api/compare/price
// Body: { city: string, products: [{ barcode: string, name: string, quantity: number }] }
router.post('/price', async (req, res) => {
  try {
    const { city, products } = req.body;
    if (!city || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Missing city or products array. Please enter a valid city and add products to your list.' });
    }
    
    console.log(`[PERFORMANCE] Starting optimized processing for ${products.length} products`);
    const startTime = Date.now();
    
    // BATCH OPTIMIZATION: Group similar products to reduce API calls
    const productGroups = new Map();
    
    for (const prod of products) {
      // Group by barcode (exact match)
      const barcodeKey = `barcode:${prod.barcode}`;
      if (productGroups.has(barcodeKey)) {
        productGroups.get(barcodeKey).push(prod);
      } else {
        productGroups.set(barcodeKey, [prod]);
      }
      
      // Group by brand name (first word)
      const words = prod.name.split(' ');
      if (words.length > 1) {
        const brandKey = `brand:${words[0]}`;
        if (productGroups.has(brandKey)) {
          productGroups.get(brandKey).push(prod);
        } else {
          productGroups.set(brandKey, [prod]);
        }
      }
    }
    
    console.log(`[PERFORMANCE] Grouped ${products.length} products into ${productGroups.size} batches`);
    
    // PARALLEL PROCESSING: Process unique products only
    const uniqueProducts = Array.from(new Set(products.map(p => p.barcode)));
    const uniqueProductData = products.filter((prod, index, arr) => 
      arr.findIndex(p => p.barcode === prod.barcode) === index
    );
    
    const productPromises = uniqueProductData.map(async (prod, index) => {
      console.log(`[DEBUG] ===== UNIQUE PRODUCT ${index + 1}/${uniqueProductData.length} =====`);
      console.log(`[DEBUG] Product: ${prod.name} (Barcode: ${prod.barcode})`);
      
      try {
        // Use enhanced search with fallback
        const prodResults = await searchProductWithFallback(city, prod);
        
        console.log(`[DEBUG] Product ${prod.name} returned ${prodResults ? prodResults.length : 0} store results`);
        if (prodResults && prodResults.length > 0) {
          console.log(`[DEBUG] First store result for ${prod.name}:`, {
            branch: prodResults[0].branch,
            address: prodResults[0].address,
            totalPrice: prodResults[0].totalPrice,
            itemsFound: prodResults[0].itemsFound,
            isFallback: prodResults[0].isFallback || false
          });
        }
        
        return { product: prod, results: prodResults || [] };
      } catch (error) {
        console.error(`[DEBUG] Error processing product ${prod.name}:`, error);
        return { product: prod, results: [] };
      }
    });
    
    // Wait for all unique products to be processed in parallel
    const productResults = await Promise.all(productPromises);
    
    console.log(`[PERFORMANCE] Parallel processing completed in ${Date.now() - startTime}ms`);
    
    // Aggregate results by store
    let allStoreResults = {};
    
    for (const { product: prod, results: prodResults } of productResults) {
      for (const storeData of prodResults) {
        // Use branch name as store key to group all stores of the same chain
        const storeKey = storeData.branch;
        
        if (!allStoreResults[storeKey]) {
          allStoreResults[storeKey] = { 
            branch: storeData.branch,
            address: storeData.address,
            addresses: [storeData.address], // Track all addresses
            totalPrice: 0, 
            itemsFound: 0, 
            foundBarcodes: [],
            itemPrices: {},
            productDetails: {},
            estimatedPrices: {}, // Track which prices are estimated
            realPrices: {} // Track which prices are real
          };
        } else {
          // Add this address to the list if it's not already there
          if (!allStoreResults[storeKey].addresses.includes(storeData.address)) {
            allStoreResults[storeKey].addresses.push(storeData.address);
          }
        }
        
        // Add this product's price to the store
        const productPrice = storeData.itemPrices[prod.barcode] || 0;
        
        // Add price regardless of whether it's real or estimated
        if (productPrice > 0) {
          // Only increment itemsFound if this is a new product (not already counted)
          if (!allStoreResults[storeKey].foundBarcodes.includes(prod.barcode)) {
            allStoreResults[storeKey].foundBarcodes.push(prod.barcode);
          }
          
          // Store individual item price
          allStoreResults[storeKey].itemPrices[prod.barcode] = productPrice;
          
          // Track whether this is a real or estimated price
          if (storeData.isFallback) {
            allStoreResults[storeKey].estimatedPrices[prod.barcode] = productPrice;
            console.log(`[DEBUG] Store ${storeKey}: Added ESTIMATED price for ${prod.name} - ₪${productPrice}`);
          } else {
            allStoreResults[storeKey].realPrices[prod.barcode] = productPrice;
            console.log(`[DEBUG] Store ${storeKey}: Added REAL price for ${prod.name} - ₪${productPrice}`);
          }
          
          // Store product details including image
          allStoreResults[storeKey].productDetails[prod.barcode] = {
            name: prod.name,
            img: prod.img,
            price: productPrice,
            isEstimated: storeData.isFallback || false
          };
        } else {
          console.log(`[DEBUG] Store ${storeKey}: No price found for ${prod.name} (barcode: ${prod.barcode})`);
        }
      }
    }
    
    // Convert to array and add missing products with estimated prices
    let aggregated = Object.values(allStoreResults);
    
    console.log('[DEBUG] ===== AGGREGATION SUMMARY =====');
    console.log('[DEBUG] Total stores found:', aggregated.length);
    console.log('[DEBUG] Store keys:', Object.keys(allStoreResults));
    
    // Add estimated prices for products not found in any store
    for (const store of aggregated) {
      const missingProducts = products.filter(p => !store.foundBarcodes.includes(p.barcode));
      
      for (const missingProd of missingProducts) {
        const estimatedPrice = await getFallbackPrice(missingProd.name, missingProd.barcode);
        
        store.foundBarcodes.push(missingProd.barcode);
        store.itemPrices[missingProd.barcode] = estimatedPrice;
        store.estimatedPrices[missingProd.barcode] = estimatedPrice;
        
        store.productDetails[missingProd.barcode] = {
          name: missingProd.name,
          img: missingProd.img,
          price: estimatedPrice,
          isEstimated: true
        };
        
        console.log(`[DEBUG] Store ${store.branch}: Added MISSING product ${missingProd.name} with estimated price ₪${estimatedPrice}`);
      }
    }
    
    // Calculate separate totals and counts for real vs estimated prices
    aggregated.forEach((storeData) => {
      // Calculate real price total
      const realPriceTotal = Object.values(storeData.realPrices).reduce((sum, price) => sum + price, 0);
      const estimatedPriceTotal = Object.values(storeData.estimatedPrices).reduce((sum, price) => sum + price, 0);
      
      // Set the counts
      storeData.realPriceCount = Object.keys(storeData.realPrices).length;
      storeData.estimatedPriceCount = Object.keys(storeData.estimatedPrices).length;
      storeData.itemsFound = storeData.realPriceCount; // Only count real prices as "found"
      storeData.totalPrice = realPriceTotal + estimatedPriceTotal; // Total for display
      storeData.realPriceTotal = realPriceTotal;
      storeData.estimatedPriceTotal = estimatedPriceTotal;
    });
    
    // Debug: Show what each store contains
    console.log('[DEBUG] ===== STORE CONTENTS =====');
    aggregated.forEach((storeData) => {
      console.log(`[DEBUG] Store: ${storeData.branch}`);
      console.log(`[DEBUG]   - Total Price: ${storeData.totalPrice}`);
      console.log(`[DEBUG]   - Real Price Total: ${storeData.realPriceTotal}`);
      console.log(`[DEBUG]   - Estimated Price Total: ${storeData.estimatedPriceTotal}`);
      console.log(`[DEBUG]   - Real Items Found: ${storeData.realPriceCount}`);
      console.log(`[DEBUG]   - Estimated Items: ${storeData.estimatedPriceCount}`);
      console.log(`[DEBUG]   - Real Prices:`, storeData.realPrices);
      console.log(`[DEBUG]   - Estimated Prices:`, storeData.estimatedPrices);
      console.log(`[DEBUG]   - All Item Prices:`, storeData.itemPrices);
    });
    
    console.log('[DEBUG] Final aggregated results:', aggregated.map(s => ({
      store: s.branch,
      totalPrice: s.totalPrice,
      itemsFound: s.itemsFound,
      score: s.score,
      itemPrices: s.itemPrices,
      realPrices: s.realPrices,
      estimatedPrices: s.estimatedPrices
    })));
    
    if (aggregated.length === 0) {
      return res.status(404).json({ 
        error: 'No stores found for your city and products. Try a different city or product.',
        fallback: 'We could not find prices for some products in your area.'
      });
    }
    
    console.log('[DEBUG] All stores have products (real or estimated):', aggregated.length, 'stores');
    
    // Calculate scores for each store - only based on real prices
    const maxRealPrice = Math.max(...aggregated.map(s => s.realPriceTotal), 1);
    const totalItems = products.length;
    
    aggregated.forEach(store => {
      const realItemsFound = store.realPriceCount;
      const realPriceTotal = store.realPriceTotal;
      
      // Client's scoring formula - only based on real prices
      const quantityScore = realItemsFound / totalItems;
      const priceScore = realPriceTotal / maxRealPrice;
      
      const score = (0.7 * quantityScore) - (0.3 * priceScore);
      
      store.score = Math.round(score * 100) / 100; // Round to 2 decimal places
      
      console.log(`[DEBUG] Store ${store.branch}: Score = ${store.score} (${realItemsFound}/${totalItems} real items, ₪${realPriceTotal} real price total)`);
    });
    
    // Sort by score (highest first)
    aggregated.sort((a, b) => b.score - a.score);
    // Distance calculation (optional, will be null if API key missing)
    const storeAddresses = aggregated.map(s => s.address);
    let distances = {};
    try {
      distances = await getDistances(city, storeAddresses);
    } catch (distErr) {
      console.error('[compare POST /price] Distance API error:', distErr);
    }
    aggregated.forEach(s => {
      s.distance = distances[s.address] || null;
    });
    res.json(aggregated.slice(0, 5));
  } catch (err) {
    console.error('[compare POST /price] error', err);
    res.status(500).json({ error: 'An unexpected server error occurred. Please try again later.' });
  }
});

module.exports = router;
