// server/routes/compareRoutes.js
const express = require('express');
const router = express.Router();
const List = require('../models/List');
const axios = require('axios');
const cheerio = require('cheerio');
const StorePriceCache = require('../models/StorePriceCache');
const { getDistances } = require('../services/distance');

async function fetchCompare(locationCity, barcode) {
  const streetId = 9000;
  const cityId = 0;
  const url = 'https://chp.co.il/main_page/compare_results';
  const params = {
    shopping_address: locationCity,
    shopping_address_street_id: streetId,
    shopping_address_city_id: cityId,
    product_barcode: barcode, // Search for single product
    from: 0,
    num_results: 30,
  };
  
  console.log('[DEBUG] Searching for single barcode:', barcode);
  const headers = {
    'User-Agent': 'Mozilla/5.0',
    'Accept': '*/*',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://chp.co.il/'
  };

  try {
    const { data: html } = await axios.get(url, { params, headers });
    const $ = cheerio.load(html);
    const results = {};

    // Updated selector for results-table
    $('.results-table tbody tr').each((_, row) => {
      const tds = $(row).find('td');
      if (tds.length >= 5) {
        const chain = $(tds[0]).text().trim();
        const storeName = $(tds[1]).text().trim();
        const address = $(tds[2]).text().trim();
        const price = parseFloat($(tds[4]).text().trim());
        
        // Debug: Log the table structure
        console.log('[DEBUG] Table row:', {
          chain,
          storeName,
          address,
          price,
          totalCells: tds.length,
          cell3: $(tds[3]).text().trim(),
          cell4: $(tds[4]).text().trim(),
          allCells: Array.from(tds).map((td, i) => ({ index: i, text: $(td).text().trim() }))
        });
        
        if (!isNaN(price) && storeName) {
          const key = `${storeName} - ${address}`;
          if (!results[key]) {
            results[key] = { 
              chain, 
              storeName, 
              address, 
              totalPrice: 0, 
              itemsFound: 0,
              itemPrices: {} // Store individual item prices
            };
          }
          results[key].totalPrice += price;
          results[key].itemsFound += 1;
          
          // Since we're searching for a single product, we know which barcode this price belongs to
          results[key].itemPrices[barcode] = price;
          console.log('[DEBUG] Stored price for', barcode, ':', price);
        }
      }
    });
    // --- CITY FILTERING FIX ---
    const cityNormalized = (locationCity || '').trim().toLowerCase();
    const filteredResults = Object.values(results).filter(r =>
      r.address && r.address.toLowerCase().includes(cityNormalized)
    );
    return filteredResults.map(r => ({
      branch: r.chain, // Changed from r.branch to r.chain
      address: r.address,
      totalPrice: parseFloat(r.totalPrice).toFixed(2), // Proper price formatting
      itemsFound: r.itemsFound,
      itemPrices: r.itemPrices || {} // Include individual item prices
    }));
  } catch (err) {
    console.error('[compare] Error fetching/parsing CHP:', err);
    throw err;
  }
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
      console.log(`[DEBUG] Searching for product ${i + 1}/${products.length}:`, prod.barcode, prod.name);
      
      // Search for this specific product
      let prodResults = await fetchCompare(city, prod.barcode);
      
      // If no results found by barcode, try by name
      if (!prodResults || prodResults.length === 0) {
        console.log(`[DEBUG] No results for barcode ${prod.barcode}, trying name search`);
        if (prod.name) {
          prodResults = await fetchCompare(city, prod.name);
        }
      }
      
      // Aggregate results by store
      for (const storeData of prodResults || []) {
        const storeKey = `${storeData.branch} - ${storeData.address}`;
        
        if (!allStoreResults[storeKey]) {
          allStoreResults[storeKey] = { 
            branch: storeData.branch,
            address: storeData.address,
            totalPrice: 0, 
            itemsFound: 0, 
            foundBarcodes: [],
            itemPrices: {},
            productDetails: {}
          };
        }
        
        // Add this product's price to the store
        const productPrice = storeData.itemPrices[prod.barcode] || 0;
        allStoreResults[storeKey].totalPrice += productPrice;
        
        if (productPrice > 0) {
          allStoreResults[storeKey].itemsFound += 1;
          if (!allStoreResults[storeKey].foundBarcodes.includes(prod.barcode)) {
            allStoreResults[storeKey].foundBarcodes.push(prod.barcode);
          }
        }
        
        // Store individual item price
        allStoreResults[storeKey].itemPrices[prod.barcode] = productPrice;
        
        // Store product details including image
        allStoreResults[storeKey].productDetails[prod.barcode] = {
          name: prod.name,
          img: prod.img,
          price: prod.price
        };
        
        console.log(`[DEBUG] Store ${storeKey}: Added ${prod.name} for ₪${productPrice}`);
      }
    }
    let aggregated = Object.values(allStoreResults);
    console.log('[DEBUG] Final aggregated results:', aggregated.map(s => ({
      store: s.branch,
      totalPrice: s.totalPrice,
      itemsFound: s.itemsFound,
      itemPrices: s.itemPrices
    })));
    if (aggregated.length === 0) {
      return res.status(404).json({ error: 'No stores found for your city and products. Try a different city or product.' });
    }
    // Sort by totalPrice ascending
    aggregated.sort((a, b) => a.totalPrice - b.totalPrice);
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
