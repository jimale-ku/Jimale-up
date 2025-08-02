// server/scripts/improveBarcodeScraping.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const axios = require('axios');
const cheerio = require('cheerio');

// Enhanced barcode strategies for government barcodes
function generateBarcodeStrategies(barcode) {
  const strategies = [];
  
  // Strategy 1: Original barcode
  strategies.push(barcode);
  
  // Strategy 2: Pad short barcodes to 13 digits
  if (/^\d+$/.test(barcode) && barcode.length < 13) {
    strategies.push(barcode.padStart(13, '0'));
  }
  
  // Strategy 3: For 6-digit barcodes, try common prefixes
  if (/^\d{6}$/.test(barcode)) {
    // Common Israeli prefixes
    const prefixes = ['729', '7290', '72900', '729000'];
    prefixes.forEach(prefix => {
      strategies.push(prefix + barcode);
    });
  }
  
  // Strategy 4: For 7-digit barcodes, try common prefixes
  if (/^\d{7}$/.test(barcode)) {
    const prefixes = ['729', '7290', '72900'];
    prefixes.forEach(prefix => {
      strategies.push(prefix + barcode);
    });
  }
  
  // Strategy 5: Remove leading zeros and try
  if (barcode.startsWith('0')) {
    strategies.push(barcode.replace(/^0+/, ''));
  }
  
  // Strategy 6: Try with leading zeros
  if (!barcode.startsWith('0') && barcode.length < 13) {
    strategies.push('0' + barcode);
  }
  
  return [...new Set(strategies)]; // Remove duplicates
}

// Test barcode with multiple strategies
async function testBarcodeStrategies(barcode, productName) {
  const strategies = generateBarcodeStrategies(barcode);
  console.log(`\n🔍 Testing "${productName}" (${barcode})`);
  console.log(`   Strategies: ${strategies.join(', ')}`);
  
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    try {
      const url = 'https://chp.co.il/main_page/compare_results';
      const params = {
        shopping_address: 'Tel Aviv',
        product_barcode: strategy
      };
      
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'Referer': 'https://chp.co.il/'
      };
      
      const response = await axios.get(url, { params, headers });
      const $ = cheerio.load(response.data);
      const resultsTable = $('.results-table tbody tr');
      
      if (resultsTable.length > 0) {
        console.log(`   ✅ Strategy ${i + 1} (${strategy}): Found ${resultsTable.length} stores`);
        return {
          success: true,
          workingStrategy: strategy,
          storeCount: resultsTable.length,
          productName,
          originalBarcode: barcode
        };
      } else {
        console.log(`   ❌ Strategy ${i + 1} (${strategy}): No results`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.log(`   ❌ Strategy ${i + 1} (${strategy}): Error - ${error.message}`);
    }
  }
  
  return {
    success: false,
    productName,
    originalBarcode: barcode
  };
}

async function improveBarcodeScraping() {
  try {
    console.log('🚀 Testing improved barcode strategies...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get products that failed in previous test
    const testProducts = await Product.find().limit(10);
    console.log(`📋 Testing ${testProducts.length} products with improved strategies...`);
    
    const results = {
      successful: [],
      failed: []
    };
    
    for (let i = 0; i < testProducts.length; i++) {
      const product = testProducts[i];
      const result = await testBarcodeStrategies(product.barcode, product.name);
      
      if (result.success) {
        results.successful.push(result);
      } else {
        results.failed.push(result);
      }
    }
    
    // Print summary
    console.log('\n📊 Improved Strategy Results:');
    console.log(`✅ Successful: ${results.successful.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    
    if (results.successful.length > 0) {
      console.log('\n🎉 Products that now work:');
      results.successful.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.productName}`);
        console.log(`      Original: ${result.originalBarcode} → Working: ${result.workingStrategy}`);
        console.log(`      Stores: ${result.storeCount}`);
      });
    }
    
    if (results.failed.length > 0) {
      console.log('\n⚠️  Products that still need work:');
      results.failed.slice(0, 5).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.productName} (${result.originalBarcode})`);
      });
    }
    
    // Calculate improvement
    const improvement = results.successful.length / testProducts.length * 100;
    console.log(`\n📈 Success Rate: ${improvement.toFixed(1)}%`);
    
    if (improvement > 60) {
      console.log('🎉 Excellent improvement! Consider updating your scraping logic.');
    } else if (improvement > 40) {
      console.log('✅ Good improvement! Some products now work better.');
    } else {
      console.log('⚠️  Limited improvement. May need additional strategies.');
    }
    
  } catch (error) {
    console.error('❌ Error testing improved strategies:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  improveBarcodeScraping()
    .then(() => {
      console.log('✅ Testing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Testing failed:', error);
      process.exit(1);
    });
}

module.exports = { generateBarcodeStrategies, testBarcodeStrategies, improveBarcodeScraping }; 