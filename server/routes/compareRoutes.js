// server/routes/compareRoutes.js
const express = require('express');
const router = express.Router();
const List = require('../models/List');
const axios = require('axios');
const cheerio = require('cheerio');
const StorePriceCache = require('../models/StorePriceCache');
const { getDistances } = require('../services/distance');

async function fetchWithRetry(url, params, headers, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[DEBUG] Attempt ${attempt}/${maxRetries} for URL:`, url);
      
      const response = await axios.get(url, { 
        params, 
        headers,
        timeout: 10000 // 10 second timeout
      });
      
      return response;
    } catch (error) {
      console.error(`[DEBUG] Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
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
  
  // Multiple search strategies
  const searchStrategies = [];
  
  // Strategy 1: Original search term (barcode or name)
  searchStrategies.push(searchTerm);
  
  // Strategy 2: Enhanced barcode handling with multiple padding options
  if (/^\d+$/.test(searchTerm)) {
    if (searchTerm.length < 13) {
      // Try different padding lengths for short barcodes
      searchStrategies.push(searchTerm.padStart(13, '0'));
      if (searchTerm.length === 8) {
        searchStrategies.push(searchTerm.padStart(12, '0'));
        searchStrategies.push(searchTerm.padStart(10, '0'));
        searchStrategies.push(searchTerm.padStart(9, '0'));
      }
    }
    
    // Strategy 3: If it's a barcode, try without leading zeros
    if (searchTerm.length === 13 && searchTerm.startsWith('0')) {
      const trimmedBarcode = searchTerm.replace(/^0+/, '');
      searchStrategies.push(trimmedBarcode);
    }
    
    // Strategy 4: Try barcode with different prefixes
    if (searchTerm.length >= 8) {
      // Try with common Israeli barcode prefixes
      const prefixes = ['729', '7290', '72900'];
      for (const prefix of prefixes) {
        if (!searchTerm.startsWith(prefix)) {
          const prefixedBarcode = prefix + searchTerm;
          if (prefixedBarcode.length <= 13) {
            searchStrategies.push(prefixedBarcode);
          }
        }
      }
    }
  }
  
  // Strategy 5: Enhanced name variations for non-barcode searches
  if (!/^\d+$/.test(searchTerm)) {
    // Remove common suffixes like "800פג" from "תירס 800פג"
    const cleanName = searchTerm.replace(/\s+\d+.*$/, '').trim();
    if (cleanName !== searchTerm) {
      searchStrategies.push(cleanName);
    }
    
    // Try without Hebrew diacritics
    const withoutDiacritics = searchTerm.replace(/[\u0591-\u05C7]/g, '');
    if (withoutDiacritics !== searchTerm) {
      searchStrategies.push(withoutDiacritics);
    }
    
    // Strategy 6: Try brand name only (first word)
    const words = searchTerm.split(' ');
    if (words.length > 1) {
      const brandName = words[0];
      if (brandName.length >= 2) {
        searchStrategies.push(brandName);
      }
    }
    
    // Strategy 7: Try without common words
    const commonWords = ['מ"ל', 'גרם', 'ליטר', 'יח', 'חטיף', 'משקה'];
    let cleanedName = searchTerm;
    for (const word of commonWords) {
      cleanedName = cleanedName.replace(new RegExp(`\\s*${word}\\s*`, 'g'), ' ');
    }
    cleanedName = cleanedName.trim();
    if (cleanedName !== searchTerm && cleanedName.length >= 3) {
      searchStrategies.push(cleanedName);
    }
  }
  
  console.log('[DEBUG] Search strategies for:', searchTerm, ':', searchStrategies);
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
    'Referer': 'https://chp.co.il/'
  };

  // Try each search strategy
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
      
      const { data: html } = await axios.get(url, { 
        params, 
        headers,
        timeout: 10000 // 10 second timeout
      });
      
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
      }

      // Updated selector for results-table
      $('.results-table tbody tr').each((_, row) => {
        const tds = $(row).find('td');
        if (tds.length >= 5) {
          const chain = $(tds[0]).text().trim();
          const storeName = $(tds[1]).text().trim();
          const address = $(tds[2]).text().trim();
          const price = parseFloat($(tds[4]).text().trim());
          
          if (!isNaN(price) && storeName) {
            const key = `${storeName} - ${address}`;
            if (!results[key]) {
              results[key] = { 
                chain, 
                storeName, 
                address, 
                totalPrice: 0, 
                itemsFound: 0,
                itemPrices: {}
              };
            }
            results[key].totalPrice += price;
            results[key].itemsFound += 1;
            results[key].itemPrices[searchTerm] = price; // Use original search term as key
            console.log('[DEBUG] Found price for', searchTerm, 'using strategy', strategy, ':', price);
          }
        }
      });
      
      // If we found results, store them but continue trying other strategies
      if (Object.keys(results).length > 0) {
        console.log('[DEBUG] Success with strategy:', strategy, 'Found', Object.keys(results).length, 'stores');
        
        // City filtering
        const cityNormalized = (locationCity || '').trim().toLowerCase();
        const filteredResults = Object.values(results).filter(r =>
          r.address && r.address.toLowerCase().includes(cityNormalized)
        );
        
        console.log(`[DEBUG] After city filtering (${cityNormalized}):`, filteredResults.length, 'stores');
        
        // Store results but don't return yet - try other strategies
        allResults.push(...filteredResults.map(r => ({
          branch: r.chain,
          address: r.address,
          totalPrice: parseFloat(r.totalPrice).toFixed(2),
          itemsFound: r.itemsFound,
          itemPrices: r.itemPrices
        })));
      }
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err) {
      console.error('[DEBUG] Strategy failed:', strategy, err.message);
      continue; // Try next strategy
    }
  }
  
  console.log('[DEBUG] All search strategies completed for:', searchTerm);
  
  // Return all accumulated results or empty array if none found
  if (allResults.length > 0) {
    console.log('[DEBUG] Returning', allResults.length, 'total results for', searchTerm);
    return allResults;
  }
  
  console.log('[DEBUG] No results found for:', searchTerm);
  return [];
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
    
    // For each product, search individually and aggregate results
    let allStoreResults = {};
    
    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      console.log(`[DEBUG] ===== PRODUCT ${i + 1}/${products.length} =====`);
      console.log(`[DEBUG] Product: ${prod.name} (Barcode: ${prod.barcode})`);
      
      // Use enhanced search with fallback
      let prodResults = await searchProductWithFallback(city, prod);
      
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
      
      // Aggregate results by store
      for (const storeData of prodResults || []) {
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
          allStoreResults[storeKey].totalPrice += productPrice;
          
          // Only increment itemsFound if this is a new product (not already counted)
          if (!allStoreResults[storeKey].foundBarcodes.includes(prod.barcode)) {
            allStoreResults[storeKey].itemsFound += 1;
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
        
        store.totalPrice += estimatedPrice;
        store.itemsFound += 1;
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
    
    // Debug: Show what each store contains
    console.log('[DEBUG] ===== STORE CONTENTS =====');
    aggregated.forEach((storeData) => {
      console.log(`[DEBUG] Store: ${storeData.branch}`);
      console.log(`[DEBUG]   - Total Price: ${storeData.totalPrice}`);
      console.log(`[DEBUG]   - Items Found: ${storeData.itemsFound}`);
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
    
    // Calculate scores for each store
    const maxPrice = Math.max(...aggregated.map(s => s.totalPrice), 1);
    const totalItems = products.length;
    
    aggregated.forEach(store => {
      const availableItems = store.itemsFound;
      const totalPrice = store.totalPrice;
      
      // Client's scoring formula
      const quantityScore = availableItems / totalItems;
      const priceScore = totalPrice / maxPrice;
      
      const score = (0.7 * quantityScore) - (0.3 * priceScore);
      
      store.score = Math.round(score * 100) / 100; // Round to 2 decimal places
      
      console.log(`[DEBUG] Store ${store.branch}: Score = ${store.score} (${availableItems}/${totalItems} items, ₪${totalPrice})`);
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
