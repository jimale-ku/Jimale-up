// server/scripts/testNameBasedSearch.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const axios = require('axios');
const cheerio = require('cheerio');

// Test name-based search for products that failed barcode search
async function testNameBasedSearch(productName, barcode) {
  console.log(`\n🔍 Testing name search for: "${productName}" (Barcode: ${barcode})`);
  
  try {
    const url = 'https://chp.co.il/main_page/compare_results';
    
    // Try different name variations
    const nameVariations = [];
    
    // Original name
    nameVariations.push(productName);
    
    // Remove quantity/size info (like "2ק"ג", "500 גר")
    const cleanName = productName.replace(/\s*\d+[קל]?[גר]?[מ"ל]?.*$/, '').trim();
    if (cleanName !== productName && cleanName.length >= 3) {
      nameVariations.push(cleanName);
    }
    
    // Try brand name only (first word)
    const words = productName.split(' ');
    if (words.length > 1) {
      const brandName = words[0];
      if (brandName.length >= 2) {
        nameVariations.push(brandName);
      }
    }
    
    // Try product type only (last meaningful word)
    const meaningfulWords = words.filter(word => word.length > 2);
    if (meaningfulWords.length > 1) {
      const productType = meaningfulWords[meaningfulWords.length - 1];
      nameVariations.push(productType);
    }
    
    // Remove duplicates
    const uniqueVariations = [...new Set(nameVariations)];
    console.log(`   Name variations: ${uniqueVariations.join(', ')}`);
    
    for (let i = 0; i < uniqueVariations.length; i++) {
      const nameVariation = uniqueVariations[i];
      
      const params = {
        shopping_address: 'Tel Aviv',
        product_barcode: nameVariation // chp.co.il accepts names in the barcode field
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
        console.log(`   ✅ Name variation ${i + 1} ("${nameVariation}"): Found ${resultsTable.length} stores`);
        
        // Show first few results
        const firstResults = [];
        resultsTable.slice(0, 3).each((index, row) => {
          const $row = $(row);
          const branch = $row.find('td:nth-child(1)').text().trim();
          const price = $row.find('td:nth-child(3)').text().trim();
          if (branch && price) {
            firstResults.push(`${branch}: ${price}`);
          }
        });
        
        if (firstResults.length > 0) {
          console.log(`      Sample results: ${firstResults.join(', ')}`);
        }
        
        return {
          success: true,
          workingName: nameVariation,
          storeCount: resultsTable.length,
          productName,
          barcode
        };
      } else {
        console.log(`   ❌ Name variation ${i + 1} ("${nameVariation}"): No results`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    return {
      success: false,
      productName,
      barcode
    };
    
  } catch (error) {
    console.log(`   ❌ Error testing name search: ${error.message}`);
    return {
      success: false,
      error: error.message,
      productName,
      barcode
    };
  }
}

async function testNameBasedSearchForFailedProducts() {
  try {
    console.log('🚀 Testing name-based search for products that failed barcode search...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get products that likely failed barcode search (dairy, soups, etc.)
    const testProducts = await Product.find({
      $or: [
        { name: { $regex: 'גבינת', $options: 'i' } }, // Cheese products
        { name: { $regex: 'מרק', $options: 'i' } },   // Soup products
        { name: { $regex: 'חלב', $options: 'i' } },   // Milk products
        { name: { $regex: 'פול', $options: 'i' } },   // Bean products
        { name: { $regex: 'שעועית', $options: 'i' } } // Bean products
      ]
    }).limit(8);
    
    console.log(`📋 Testing ${testProducts.length} products with name-based search...`);
    
    const results = {
      successful: [],
      failed: []
    };
    
    for (let i = 0; i < testProducts.length; i++) {
      const product = testProducts[i];
      const result = await testNameBasedSearch(product.name, product.barcode);
      
      if (result.success) {
        results.successful.push(result);
      } else {
        results.failed.push(result);
      }
    }
    
    // Print summary
    console.log('\n📊 Name-Based Search Results:');
    console.log(`✅ Successful: ${results.successful.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    
    if (results.successful.length > 0) {
      console.log('\n🎉 Products that work with name search:');
      results.successful.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.productName}`);
        console.log(`      Working name: "${result.workingName}"`);
        console.log(`      Stores found: ${result.storeCount}`);
      });
    }
    
    if (results.failed.length > 0) {
      console.log('\n⚠️  Products that still need work:');
      results.failed.slice(0, 5).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.productName} (${result.barcode})`);
      });
    }
    
    // Calculate success rate
    const successRate = results.successful.length / testProducts.length * 100;
    console.log(`\n📈 Name Search Success Rate: ${successRate.toFixed(1)}%`);
    
    if (successRate > 50) {
      console.log('🎉 Excellent! Name-based search works well as a fallback.');
      console.log('💡 Consider updating your scraping logic to use name search when barcode fails.');
    } else if (successRate > 30) {
      console.log('✅ Good! Name-based search helps with some products.');
    } else {
      console.log('⚠️  Limited success with name search. May need additional strategies.');
    }
    
    // Combined success rate estimate
    console.log('\n📊 Combined Strategy Estimate:');
    console.log('   Barcode success: ~40%');
    console.log('   Name search success: ~' + successRate.toFixed(0) + '%');
    console.log('   Combined success: ~' + Math.min(100, (40 + successRate * 0.6)).toFixed(0) + '%');
    
  } catch (error) {
    console.error('❌ Error testing name-based search:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testNameBasedSearchForFailedProducts()
    .then(() => {
      console.log('✅ Testing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testNameBasedSearch, testNameBasedSearchForFailedProducts }; 