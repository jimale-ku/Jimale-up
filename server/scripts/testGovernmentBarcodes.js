// server/scripts/testGovernmentBarcodes.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const axios = require('axios');
const cheerio = require('cheerio');

// Simple test function for chp.co.il scraping
async function testBarcodeWithChp(barcode, productName) {
  try {
    const url = 'https://chp.co.il/main_page/compare_results';
    const params = {
      shopping_address: 'Tel Aviv',
      product_barcode: barcode
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
    
    // Check if results table exists
    const resultsTable = $('.results-table tbody tr');
    const hasResults = resultsTable.length > 0;
    
    return {
      success: true,
      hasResults,
      storeCount: resultsTable.length,
      productName,
      barcode
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      productName,
      barcode
    };
  }
}

async function testGovernmentBarcodes() {
  try {
    console.log('🧪 Testing government barcodes with chp.co.il...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get a sample of products to test
    const testProducts = await Product.find().limit(20);
    console.log(`📋 Testing ${testProducts.length} products...`);
    
    const results = {
      successful: [],
      failed: [],
      withResults: [],
      withoutResults: []
    };
    
    // Test each product
    for (let i = 0; i < testProducts.length; i++) {
      const product = testProducts[i];
      console.log(`\n🔍 Testing ${i + 1}/${testProducts.length}: ${product.name} (${product.barcode})`);
      
      const result = await testBarcodeWithChp(product.barcode, product.name);
      
      if (result.success) {
        results.successful.push(result);
        
        if (result.hasResults) {
          results.withResults.push(result);
          console.log(`   ✅ Found ${result.storeCount} stores`);
        } else {
          results.withoutResults.push(result);
          console.log(`   ⚠️  No stores found`);
        }
      } else {
        results.failed.push(result);
        console.log(`   ❌ Failed: ${result.error}`);
      }
      
      // Small delay to be respectful to chp.co.il
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Print summary
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Successful requests: ${results.successful.length}`);
    console.log(`❌ Failed requests: ${results.failed.length}`);
    console.log(`🛒 Products with store results: ${results.withResults.length}`);
    console.log(`⚠️  Products without store results: ${results.withoutResults.length}`);
    
    // Show successful products with results
    if (results.withResults.length > 0) {
      console.log('\n🎉 Products that work with chp.co.il:');
      results.withResults.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.productName} (${result.barcode}) - ${result.storeCount} stores`);
      });
    }
    
    // Show products without results
    if (results.withoutResults.length > 0) {
      console.log('\n⚠️  Products without store results:');
      results.withoutResults.slice(0, 5).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.productName} (${result.barcode})`);
      });
      if (results.withoutResults.length > 5) {
        console.log(`   ... and ${results.withoutResults.length - 5} more`);
      }
    }
    
    // Show failed requests
    if (results.failed.length > 0) {
      console.log('\n❌ Failed requests:');
      results.failed.slice(0, 3).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.productName} (${result.barcode}) - ${result.error}`);
      });
    }
    
    // Calculate success rate
    const totalTested = results.successful.length + results.failed.length;
    const successRate = totalTested > 0 ? (results.successful.length / totalTested * 100).toFixed(1) : 0;
    const resultsRate = results.successful.length > 0 ? (results.withResults.length / results.successful.length * 100).toFixed(1) : 0;
    
    console.log('\n📈 Success Rates:');
    console.log(`   API Success Rate: ${successRate}%`);
    console.log(`   Products with Results: ${resultsRate}%`);
    
    if (resultsRate > 70) {
      console.log('\n🎉 Excellent! Most government barcodes work with chp.co.il');
    } else if (resultsRate > 50) {
      console.log('\n✅ Good! Many government barcodes work with chp.co.il');
    } else {
      console.log('\n⚠️  Warning: Many government barcodes may not work with chp.co.il');
      console.log('   Consider updating your scraping logic or using fallback strategies');
    }
    
  } catch (error) {
    console.error('❌ Error testing barcodes:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testGovernmentBarcodes()
    .then(() => {
      console.log('✅ Testing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Testing failed:', error);
      process.exit(1);
    });
}

module.exports = testGovernmentBarcodes; 