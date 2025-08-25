// Test script for Ramat Gan scenario
const axios = require('axios');
const cheerio = require('cheerio');

// Test the specific scenario that failed for the client
const testCity = 'רמת גן';
const testProduct = 'דבש לחיץ 200';

console.log('🧪 Testing scraping scenario:');
console.log(`📍 City: ${testCity}`);
console.log(`🛒 Product: ${testProduct}`);
console.log('─'.repeat(50));

// Test 1: Direct CHP API call
async function testCHPDirect() {
  console.log('\n🔍 Test 1: Direct CHP API call');
  
  const url = 'https://chp.co.il/main_page/compare_results';
  const params = {
    shopping_address: testCity,
    shopping_address_street_id: 9000,
    shopping_address_city_id: 0,
    product_barcode: testProduct,
    from: 0,
    num_results: 30,
  };
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
    'Referer': 'https://chp.co.il/'
  };

  try {
    console.log('📡 Making request to CHP...');
    const response = await axios.get(url, { params, headers, timeout: 15000 });
    
    console.log(`✅ Response received: ${response.status} status, ${response.data.length} characters`);
    
    // Parse the response
    const $ = cheerio.load(response.data);
    const resultsTable = $('.results-table tbody tr');
    
    console.log(`📊 Found ${resultsTable.length} result rows`);
    
    if (resultsTable.length === 0) {
      console.log('❌ No results found in table');
      
      // Check if there's an error message
      const errorMsg = $('.error, .no-results, .message').text().trim();
      if (errorMsg) {
        console.log(`⚠️ Error message: ${errorMsg}`);
      }
      
      // Check the page content for debugging
      const pageText = $('body').text().substring(0, 500);
      console.log(`📄 Page content preview: ${pageText}...`);
      
      return false;
    }
    
    // Parse results
    const results = [];
    resultsTable.each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length >= 5) {
        const storeName = cells.eq(0).text().trim();
        const branch = cells.eq(1).text().trim();
        const address = cells.eq(2).text().trim();
        const col4Text = cells.eq(3).text().trim();
        const col5Text = cells.eq(4).text().trim();
        
        console.log(`🏪 Store: ${storeName} | Branch: ${branch} | Address: ${address}`);
        console.log(`💰 Price columns: [${col4Text}] [${col5Text}]`);
        
        // Try to extract price
        let priceText = '';
        if (/^\d+\.?\d*$/.test(col4Text)) {
          priceText = col4Text;
        } else if (/^\d+\.?\d*$/.test(col5Text)) {
          priceText = col5Text;
        }
        
        if (priceText) {
          const price = parseFloat(priceText);
          console.log(`✅ Found price: ${price}₪`);
          results.push({ storeName, branch, address, price });
        } else {
          console.log(`❌ No valid price found`);
        }
      }
    });
    
    console.log(`\n📋 Summary: Found ${results.length} stores with prices`);
    return results.length > 0;
    
  } catch (error) {
    console.error('❌ CHP API error:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${error.response.data.substring(0, 200)}...`);
    }
    return false;
  }
}

// Test 2: Try different search strategies
async function testSearchStrategies() {
  console.log('\n🔍 Test 2: Different search strategies');
  
  const strategies = [
    testProduct,                    // Original: "דבש לחיץ 200"
    'דבש לחיץ',                    // Remove numbers
    'דבש',                         // Just "honey"
    'לחיץ',                        // Just "Lachish"
    '200',                         // Just the number
    'דבש לחיץ 200גרם',            // Add common weight suffix
    'דבש לחיץ 200 גרם',           // Add space before weight
  ];
  
  for (const strategy of strategies) {
    console.log(`\n🔍 Trying strategy: "${strategy}"`);
    
    const url = 'https://chp.co.il/main_page/compare_results';
    const params = {
      shopping_address: testCity,
      shopping_address_street_id: 9000,
      shopping_address_city_id: 0,
      product_barcode: strategy,
      from: 0,
      num_results: 30,
    };
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
      'Referer': 'https://chp.co.il/'
    };

    try {
      const response = await axios.get(url, { params, headers, timeout: 10000 });
      const $ = cheerio.load(response.data);
      const resultsTable = $('.results-table tbody tr');
      
      console.log(`   📊 Found ${resultsTable.length} results`);
      
      if (resultsTable.length > 0) {
        console.log(`   ✅ Strategy "${strategy}" WORKED!`);
        return strategy;
      }
      
    } catch (error) {
      console.log(`   ❌ Strategy "${strategy}" failed: ${error.message}`);
    }
  }
  
  console.log('❌ No search strategy worked');
  return null;
}

// Test 3: Check if city name is recognized
async function testCityRecognition() {
  console.log('\n🔍 Test 3: City name recognition');
  
  const testCities = [
    'רמת גן',
    'רמת-גן',
    'Ramat Gan',
    'רמת גן, ישראל',
    'Ramat Gan, Israel'
  ];
  
  for (const city of testCities) {
    console.log(`\n📍 Testing city: "${city}"`);
    
    const url = 'https://chp.co.il/main_page/compare_results';
    const params = {
      shopping_address: city,
      shopping_address_street_id: 9000,
      shopping_address_city_id: 0,
      product_barcode: 'דבש', // Use simple product for city test
      from: 0,
      num_results: 30,
    };
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
      'Referer': 'https://chp.co.il/'
    };

    try {
      const response = await axios.get(url, { params, headers, timeout: 10000 });
      const $ = cheerio.load(response.data);
      const resultsTable = $('.results-table tbody tr');
      
      console.log(`   📊 Found ${resultsTable.length} results`);
      
      if (resultsTable.length > 0) {
        console.log(`   ✅ City "${city}" is recognized!`);
        return city;
      }
      
    } catch (error) {
      console.log(`   ❌ City "${city}" failed: ${error.message}`);
    }
  }
  
  console.log('❌ No city format worked');
  return null;
}

// Test 4: Check your server's scraping logic
async function testServerLogic() {
  console.log('\n🔍 Test 4: Your server scraping logic');
  
  try {
    // Test your server's compare endpoint
    const response = await axios.post('http://localhost:5000/api/compare/price', {
      city: testCity,
      products: [{
        barcode: testProduct,
        name: testProduct,
        quantity: 1
      }]
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Server response received');
    console.log(`📊 Found ${response.data.length || response.data.stores?.length || 0} stores`);
    
    if (response.data.stores && response.data.stores.length > 0) {
      response.data.stores.forEach((store, index) => {
        console.log(`🏪 Store ${index + 1}: ${store.branch} - ${store.address}`);
        console.log(`💰 Total Price: ${store.totalPrice}₪`);
        console.log(`📦 Items Found: ${store.itemsFound}`);
      });
      return true;
    } else {
      console.log('❌ No stores found in server response');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Server test failed:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive test for Ramat Gan scenario...\n');
  
  // Test 1: Direct CHP API
  const chpResult = await testCHPDirect();
  
  // Test 2: Search strategies
  const strategyResult = await testSearchStrategies();
  
  // Test 3: City recognition
  const cityResult = await testCityRecognition();
  
  // Test 4: Server logic
  const serverResult = await testServerLogic();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`📍 City: ${testCity}`);
  console.log(`🛒 Product: ${testProduct}`);
  console.log(`🔍 Direct CHP API: ${chpResult ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`🔍 Search Strategies: ${strategyResult ? `✅ WORKING (${strategyResult})` : '❌ FAILED'}`);
  console.log(`📍 City Recognition: ${cityResult ? `✅ WORKING (${cityResult})` : '❌ FAILED'}`);
  console.log(`🖥️ Server Logic: ${serverResult ? '✅ WORKING' : '❌ FAILED'}`);
  
  if (!chpResult && !strategyResult && !cityResult && !serverResult) {
    console.log('\n🚨 ALL TESTS FAILED - This indicates a fundamental issue with:');
    console.log('   1. Network connectivity to CHP');
    console.log('   2. City name format recognition');
    console.log('   3. Product name format');
    console.log('   4. Server configuration');
  } else if (chpResult || strategyResult || cityResult) {
    console.log('\n✅ Some tests passed - The issue is likely in your server logic');
  }
}

// Run the tests
runAllTests().catch(console.error);
