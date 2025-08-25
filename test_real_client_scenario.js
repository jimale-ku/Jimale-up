// Test the real client scenario with the specific product and city
const axios = require('axios');

async function testRealClientScenario() {
  console.log('🧪 Testing Real Client Scenario');
  console.log('─'.repeat(50));
  
  // The exact scenario from your client
  const clientScenario = {
    city: 'רמת גן',
    product: 'דבש לחיץ 200'
  };
  
  console.log('📱 CLIENT SCENARIO:');
  console.log(`📍 City: ${clientScenario.city}`);
  console.log(`🛒 Product: ${clientScenario.product}`);
  console.log('');
  
  try {
    // Step 1: Check if server is running
    console.log('🔍 Step 1: Checking server status...');
    
    let serverRunning = false;
    try {
      await axios.get('http://localhost:5000/api/health', { timeout: 5000 });
      serverRunning = true;
      console.log('✅ Server is running on localhost:5000');
    } catch (error) {
      console.log('❌ Server is not running on localhost:5000');
      console.log('   You need to start your server first:');
      console.log('   cd Jimale-up/server && npm start');
      console.log('');
      console.log('   For now, I\'ll test the scraping logic directly...');
    }
    
    // Step 2: Test the scraping logic directly (what your server would do)
    console.log('\n🔍 Step 2: Testing scraping logic...');
    
    const MultiScraper = require('./server/services/multiScraper');
    const multiScraper = new MultiScraper();
    
    console.log(`🔍 Searching for "${clientScenario.product}" in "${clientScenario.city}"...`);
    
    const results = await multiScraper.searchProduct(clientScenario.city, clientScenario.product);
    
    if (results && results.length > 0) {
      console.log(`✅ Found ${results.length} raw results!`);
      
      // Step 3: Aggregate results (like your server does)
      console.log('\n🔍 Step 3: Aggregating results...');
      
      const aggregated = multiScraper.aggregateResults(results);
      
      console.log(`✅ Aggregated into ${aggregated.length} stores`);
      
      // Step 4: Show what the client would see
      console.log('\n📱 WHAT YOUR CLIENT WILL SEE:');
      console.log('─'.repeat(50));
      console.log(`📍 Location: ${clientScenario.city}`);
      console.log(`🛒 Product: ${clientScenario.product}`);
      console.log(`🏪 Found ${aggregated.length} stores:`);
      console.log('');
      
      aggregated.forEach((store, index) => {
        console.log(`${index + 1}. ${store.branch}`);
        console.log(`   📍 ${store.address}`);
        console.log(`   💰 ${store.totalPrice}₪`);
        console.log(`   📦 ${store.itemsFound} item(s) found`);
        
        // Show individual product prices
        Object.entries(store.itemPrices).forEach(([product, price]) => {
          console.log(`      • ${product}: ${price}₪`);
        });
        console.log('');
      });
      
      // Price comparison summary
      const prices = aggregated.map(store => store.totalPrice).sort((a, b) => a - b);
      console.log('💰 PRICE COMPARISON SUMMARY:');
      console.log(`   Cheapest: ${prices[0]}₪`);
      console.log(`   Most Expensive: ${prices[prices.length - 1]}₪`);
      console.log(`   Price Difference: ${(prices[prices.length - 1] - prices[0]).toFixed(2)}₪`);
      
      // Step 5: If server is running, test the actual API call
      if (serverRunning) {
        console.log('\n🔍 Step 4: Testing actual API call to server...');
        
        const apiRequest = {
          city: clientScenario.city,
          products: [
            {
              name: clientScenario.product,
              barcode: '123456789' // Mock barcode
            }
          ]
        };
        
        try {
          const response = await axios.post('http://localhost:5000/api/compare/price', apiRequest, {
            timeout: 30000
          });
          
          console.log('✅ API call successful!');
          console.log('📥 Server response status:', response.status);
          
          if (response.data.success) {
            console.log('✅ Server returned success response');
            console.log(`📊 Found ${response.data.data.stores.length} stores via API`);
          } else {
            console.log('❌ Server returned error response');
            console.log('Error:', response.data.message);
          }
          
        } catch (error) {
          console.log('❌ API call failed:', error.message);
        }
      }
      
      return true;
      
    } else {
      console.log('❌ No results found for this product and city');
      console.log('');
      console.log('🔍 This means:');
      console.log('   • The product might not be available in this city');
      console.log('   • The product name might need adjustment');
      console.log('   • There might be a scraping issue');
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test with variations of the product name
async function testProductVariations() {
  console.log('\n🧪 Testing Product Name Variations');
  console.log('─'.repeat(50));
  
  const city = 'רמת גן';
  const productVariations = [
    'דבש לחיץ 200',
    'דבש לחיץ',
    'דבש',
    'לחיץ דבש',
    'דבש לחיץ 200 גרם'
  ];
  
  const MultiScraper = require('./server/services/multiScraper');
  const multiScraper = new MultiScraper();
  
  for (const product of productVariations) {
    console.log(`\n🔍 Testing: "${product}"`);
    
    try {
      const results = await multiScraper.searchProduct(city, product);
      
      if (results && results.length > 0) {
        const aggregated = multiScraper.aggregateResults(results);
        console.log(`✅ Found ${aggregated.length} stores`);
        
        // Show cheapest price
        const prices = aggregated.map(store => store.totalPrice).sort((a, b) => a - b);
        console.log(`   Cheapest: ${prices[0]}₪`);
        
        // Show what products were actually found
        const foundProducts = new Set();
        aggregated.forEach(store => {
          Object.keys(store.itemPrices).forEach(product => foundProducts.add(product));
        });
        console.log(`   Products found: ${Array.from(foundProducts).join(', ')}`);
        
      } else {
        console.log('❌ No results');
      }
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
}

// Run the complete test
async function runRealClientTest() {
  console.log('🚀 Testing Real Client Scenario...\n');
  
  const mainResult = await testRealClientScenario();
  await testProductVariations();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 REAL CLIENT TEST SUMMARY');
  console.log('='.repeat(60));
  
  if (mainResult) {
    console.log('✅ SUCCESS! Your client will get results.');
    console.log('');
    console.log('📱 TO TEST IN YOUR CLIENT APP:');
    console.log('1. Start your server: cd Jimale-up/server && npm start');
    console.log('2. Open your client app');
    console.log('3. Add product: "דבש לחיץ 200" to your list');
    console.log('4. Set location to: "רמת גן"');
    console.log('5. Search for stores');
    console.log('6. You should see the same results as above!');
  } else {
    console.log('❌ ISSUES FOUND');
    console.log('');
    console.log('🔧 NEXT STEPS:');
    console.log('1. Check the error messages above');
    console.log('2. Try different product name variations');
    console.log('3. Verify your server is running');
    console.log('4. Check network connectivity');
  }
}

runRealClientTest().catch(console.error);
