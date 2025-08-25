// Test CHP website accessibility
const axios = require('axios');
const cheerio = require('cheerio');

async function testCHPAccess() {
  console.log('🔍 Testing CHP Website Accessibility');
  console.log('─'.repeat(50));
  
  // Test 1: Basic website access
  console.log('📡 Test 1: Basic CHP website access');
  try {
    const response = await axios.get('https://chp.co.il/', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log(`✅ CHP main page accessible: ${response.status} status, ${response.data.length} characters`);
  } catch (error) {
    console.log(`❌ CHP main page failed: ${error.message}`);
    return false;
  }
  
  // Test 2: Search with a very common product
  console.log('\n📡 Test 2: Search for common product "חלב" (milk)');
  try {
    const response = await axios.get('https://chp.co.il/main_page/compare_results', {
      params: {
        shopping_address: 'תל אביב',
        shopping_address_street_id: 9000,
        shopping_address_city_id: 0,
        product_barcode: 'חלב',
        from: 0,
        num_results: 30,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'Referer': 'https://chp.co.il/'
      },
      timeout: 15000
    });
    
    console.log(`✅ Search response: ${response.status} status, ${response.data.length} characters`);
    
    // Check if it contains "product not found"
    if (response.data.includes('המוצר שחיפשתם לא נמצא')) {
      console.log('❌ CHP is returning "Product not found" for common products');
      console.log('📄 Response preview:', response.data.substring(0, 200));
      return false;
    }
    
    // Parse results
    const $ = cheerio.load(response.data);
    const resultsTable = $('.results-table tbody tr');
    console.log(`📊 Found ${resultsTable.length} result rows`);
    
    if (resultsTable.length > 0) {
      console.log('✅ CHP search is working!');
      return true;
    } else {
      console.log('❌ No results found in table');
      return false;
    }
    
  } catch (error) {
    console.log(`❌ CHP search failed: ${error.message}`);
    return false;
  }
}

// Test 3: Try different user agents
async function testDifferentUserAgents() {
  console.log('\n📡 Test 3: Testing different user agents');
  
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
  ];
  
  for (const userAgent of userAgents) {
    try {
      console.log(`🔍 Testing User-Agent: ${userAgent.substring(0, 50)}...`);
      
      const response = await axios.get('https://chp.co.il/main_page/compare_results', {
        params: {
          shopping_address: 'תל אביב',
          shopping_address_street_id: 9000,
          shopping_address_city_id: 0,
          product_barcode: 'חלב',
          from: 0,
          num_results: 30,
        },
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
          'Connection': 'keep-alive',
          'Referer': 'https://chp.co.il/'
        },
        timeout: 10000
      });
      
      if (!response.data.includes('המוצר שחיפשתם לא נמצא')) {
        const $ = cheerio.load(response.data);
        const resultsTable = $('.results-table tbody tr');
        if (resultsTable.length > 0) {
          console.log(`✅ User-Agent worked! Found ${resultsTable.length} results`);
          return userAgent;
        }
      }
      
    } catch (error) {
      console.log(`❌ User-Agent failed: ${error.message}`);
    }
  }
  
  console.log('❌ No User-Agent worked');
  return null;
}

// Test 4: Check if CHP requires cookies/session
async function testWithSession() {
  console.log('\n📡 Test 4: Testing with session cookies');
  
  try {
    // First, get the main page to establish session
    const session = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive'
      }
    });
    
    // Get main page
    const mainResponse = await session.get('https://chp.co.il/');
    console.log('✅ Got main page, establishing session');
    
    // Now try search
    const searchResponse = await session.get('https://chp.co.il/main_page/compare_results', {
      params: {
        shopping_address: 'תל אביב',
        shopping_address_street_id: 9000,
        shopping_address_city_id: 0,
        product_barcode: 'חלב',
        from: 0,
        num_results: 30,
      },
      headers: {
        'Referer': 'https://chp.co.il/'
      }
    });
    
    if (!searchResponse.data.includes('המוצר שחיפשתם לא נמצא')) {
      const $ = cheerio.load(searchResponse.data);
      const resultsTable = $('.results-table tbody tr');
      if (resultsTable.length > 0) {
        console.log(`✅ Session-based search worked! Found ${resultsTable.length} results`);
        return true;
      }
    }
    
    console.log('❌ Session-based search failed');
    return false;
    
  } catch (error) {
    console.log(`❌ Session test failed: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Testing CHP Website Accessibility...\n');
  
  const basicAccess = await testCHPAccess();
  const workingUserAgent = await testDifferentUserAgents();
  const sessionWorks = await testWithSession();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 CHP ACCESSIBILITY SUMMARY');
  console.log('='.repeat(60));
  console.log(`🔍 Basic Access: ${basicAccess ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`🔍 User-Agent Test: ${workingUserAgent ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`🔍 Session Test: ${sessionWorks ? '✅ WORKING' : '❌ FAILED'}`);
  
  if (basicAccess || workingUserAgent || sessionWorks) {
    console.log('\n✅ CHP is accessible! The issue is with your scraping configuration.');
    if (workingUserAgent) {
      console.log(`💡 Use this User-Agent: ${workingUserAgent}`);
    }
  } else {
    console.log('\n❌ CHP is blocking all requests. Possible solutions:');
    console.log('   1. CHP has implemented anti-bot protection');
    console.log('   2. Your IP is being rate-limited');
    console.log('   3. CHP requires authentication');
    console.log('   4. CHP has changed their API structure');
  }
}

runAllTests().catch(console.error);
