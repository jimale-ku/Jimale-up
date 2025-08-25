// Debug test to see what CHP is actually returning
const axios = require('axios');
const cheerio = require('cheerio');

async function debugCHPResponse() {
  console.log('🔍 Debugging CHP Response');
  console.log('─'.repeat(50));
  
  const testCity = 'רמת גן';
  const testProduct = 'דבש לחיץ 200';
  
  console.log(`📍 City: ${testCity}`);
  console.log(`🛒 Product: ${testProduct}`);
  console.log('');
  
  const streetId = 9000;
  const cityId = 0;
  const url = 'https://chp.co.il/main_page/compare_results';
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
    'Referer': 'https://chp.co.il/'
  };

  try {
    console.log('📡 Making request to CHP...');
    
    const params = {
      shopping_address: testCity,
      shopping_address_street_id: streetId,
      shopping_address_city_id: cityId,
      product_barcode: testProduct,
      from: 0,
      num_results: 30,
    };
    
    console.log('📋 Request params:', params);
    
    const response = await axios.get(url, { 
      params, 
      headers,
      timeout: 15000
    });
    
    console.log(`✅ Response received: ${response.status} status`);
    console.log(`📄 Response length: ${response.data.length} characters`);
    
    // Check if response contains "product not found"
    if (response.data.includes('המוצר שחיפשתם לא נמצא')) {
      console.log('❌ CHP returned "Product not found" message');
      console.log('📄 Response preview (first 500 chars):');
      console.log(response.data.substring(0, 500));
      return;
    }
    
    // Parse with cheerio
    const $ = cheerio.load(response.data);
    
    // Check for results table
    const resultsTable = $('.results-table tbody tr');
    console.log(`📊 Results table rows found: ${resultsTable.length}`);
    
    if (resultsTable.length === 0) {
      console.log('❌ No results table found');
      console.log('🔍 Looking for other possible selectors...');
      
      // Try other possible selectors
      const possibleSelectors = [
        '.results-table',
        'table tbody tr',
        '.product-results',
        '.search-results',
        'tr'
      ];
      
      for (const selector of possibleSelectors) {
        const elements = $(selector);
        console.log(`   ${selector}: ${elements.length} elements`);
      }
      
      console.log('📄 Full response preview (first 1000 chars):');
      console.log(response.data.substring(0, 1000));
      return;
    }
    
    // If we found results, show them
    console.log('✅ Found results!');
    resultsTable.each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      console.log(`Row ${i + 1}: ${cells.length} cells`);
      
      cells.each((j, cell) => {
        const text = $(cell).text().trim();
        console.log(`   Cell ${j + 1}: "${text}"`);
      });
    });
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    
    if (error.response) {
      console.log(`📡 HTTP Status: ${error.response.status}`);
      console.log(`📄 Response data: ${error.response.data.substring(0, 500)}`);
    }
  }
}

// Also test with a simple product
async function testSimpleProduct() {
  console.log('\n🔍 Testing with simple product "דבש"...');
  console.log('─'.repeat(50));
  
  const testCity = 'רמת גן';
  const testProduct = 'דבש';
  
  const streetId = 9000;
  const cityId = 0;
  const url = 'https://chp.co.il/main_page/compare_results';
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
    'Referer': 'https://chp.co.il/'
  };

  try {
    const params = {
      shopping_address: testCity,
      shopping_address_street_id: streetId,
      shopping_address_city_id: cityId,
      product_barcode: testProduct,
      from: 0,
      num_results: 30,
    };
    
    const response = await axios.get(url, { 
      params, 
      headers,
      timeout: 15000
    });
    
    console.log(`✅ Response: ${response.status} status, ${response.data.length} chars`);
    
    if (response.data.includes('המוצר שחיפשתם לא נמצא')) {
      console.log('❌ Even "דבש" returns "Product not found"');
      console.log('📄 Response preview:');
      console.log(response.data.substring(0, 300));
    } else {
      const $ = cheerio.load(response.data);
      const resultsTable = $('.results-table tbody tr');
      console.log(`📊 Found ${resultsTable.length} results for "דבש"`);
    }
    
  } catch (error) {
    console.error('❌ Simple test failed:', error.message);
  }
}

// Run debug tests
async function runDebugTests() {
  console.log('🚀 Debugging CHP Response...\n');
  
  await debugCHPResponse();
  await testSimpleProduct();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 DEBUG SUMMARY');
  console.log('='.repeat(60));
  console.log('This will show us exactly what CHP is returning.');
}

runDebugTests().catch(console.error);
