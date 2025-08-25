// Test CHP autocompletion API with correct parameters
const axios = require('axios');

async function testCHPAutocompletion() {
  console.log('🔍 Testing CHP Autocompletion API');
  console.log('─'.repeat(50));
  
  const testProduct = 'דבש לחיץ 200';
  const testCity = 'רמת גן';
  
  try {
    // Test 1: Product autocompletion
    console.log('📡 Test 1: Product autocompletion...');
    
    const productResponse = await axios.get('https://chp.co.il/autocompletion/product_extended', {
      params: {
        term: testProduct,
        limit: 10
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'Referer': 'https://chp.co.il/',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000
    });
    
    console.log(`✅ Product autocompletion: ${productResponse.status} status`);
    console.log(`📄 Response: ${JSON.stringify(productResponse.data)}`);
    
    // Test 2: City autocompletion
    console.log('\n📡 Test 2: City autocompletion...');
    
    const cityResponse = await axios.get('https://chp.co.il/autocompletion/shopping_address', {
      params: {
        term: testCity,
        limit: 10
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'Referer': 'https://chp.co.il/',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000
    });
    
    console.log(`✅ City autocompletion: ${cityResponse.status} status`);
    console.log(`📄 Response: ${JSON.stringify(cityResponse.data)}`);
    
    // Test 3: Try different product terms
    console.log('\n📡 Test 3: Different product terms...');
    
    const productTerms = ['דבש', 'לחיץ', 'honey', 'lachish'];
    
    for (const term of productTerms) {
      try {
        const response = await axios.get('https://chp.co.il/autocompletion/product_extended', {
          params: {
            term: term,
            limit: 5
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'keep-alive',
            'Referer': 'https://chp.co.il/',
            'X-Requested-With': 'XMLHttpRequest'
          },
          timeout: 10000
        });
        
        console.log(`   "${term}": ${response.data.length} results`);
        if (response.data.length > 0) {
          console.log(`   Sample: ${JSON.stringify(response.data[0])}`);
        }
        
      } catch (error) {
        console.log(`   "${term}": Failed - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testCompareResultsWithSession() {
  console.log('\n🔍 Testing Compare Results with Session');
  console.log('─'.repeat(50));
  
  const testProduct = 'דבש לחיץ 200';
  const testCity = 'רמת גן';
  
  try {
    // Step 1: Create a session and get main page
    console.log('📡 Step 1: Creating session...');
    
    const session = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive'
      }
    });
    
    // Get main page to establish session
    const mainResponse = await session.get('https://chp.co.il/');
    console.log(`✅ Main page loaded: ${mainResponse.status}`);
    
    // Step 2: Get product suggestions
    console.log('\n📡 Step 2: Getting product suggestions...');
    
    const productSuggestions = await session.get('https://chp.co.il/autocompletion/product_extended', {
      params: {
        term: 'דבש',
        limit: 5
      },
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://chp.co.il/'
      }
    });
    
    console.log(`✅ Product suggestions: ${productSuggestions.data.length} results`);
    
    if (productSuggestions.data.length > 0) {
      // Use the first suggestion for comparison
      const suggestedProduct = productSuggestions.data[0];
      console.log(`📦 Using suggested product: ${JSON.stringify(suggestedProduct)}`);
      
      // Step 3: Try compare results with suggested product
      console.log('\n📡 Step 3: Trying compare results...');
      
      const compareResponse = await session.post('https://chp.co.il/main_page/compare_results', {
        shopping_address: testCity,
        shopping_address_street_id: 9000,
        shopping_address_city_id: 0,
        product_barcode: suggestedProduct.value || suggestedProduct.id || 'דבש',
        from: 0,
        num_results: 30
      }, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://chp.co.il/'
        }
      });
      
      console.log(`✅ Compare response: ${compareResponse.status} status, ${compareResponse.data.length} chars`);
      
      if (compareResponse.data.includes('המוצר שחיפשתם לא נמצא')) {
        console.log('❌ Still getting "Product not found"');
      } else {
        console.log('✅ Compare results might work!');
        console.log(`Preview: ${compareResponse.data.substring(0, 300)}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Session test failed:', error.message);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Testing CHP Autocompletion API...\n');
  
  await testCHPAutocompletion();
  await testCompareResultsWithSession();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 AUTOCOMPLETION TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('This will help us understand how CHP\'s autocompletion works.');
}

runTests().catch(console.error);
