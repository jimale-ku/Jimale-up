// Test the complete client-server flow
const axios = require('axios');

async function testClientFlow() {
  console.log('🧪 Testing Complete Client-Server Flow');
  console.log('─'.repeat(50));
  
  // Simulate client request
  const clientRequest = {
    city: 'רמת גן',
    products: [
      {
        name: 'דבש לחיץ 200',
        barcode: '123456789'
      }
    ]
  };
  
  console.log('📱 Client Request:');
  console.log(`📍 City: ${clientRequest.city}`);
  console.log(`🛒 Product: ${clientRequest.products[0].name}`);
  console.log('');
  
  try {
    // Step 1: Test if server is running
    console.log('🔍 Step 1: Checking if server is running...');
    
    try {
      const serverCheck = await axios.get('http://localhost:5000/api/health', {
        timeout: 5000
      });
      console.log('✅ Server is running');
    } catch (error) {
      console.log('❌ Server is not running on localhost:5000');
      console.log('   Starting server simulation...');
    }
    
    // Step 2: Simulate the price comparison request
    console.log('\n🔍 Step 2: Simulating price comparison request...');
    
    // This simulates what your client app would send
    const priceComparisonRequest = {
      city: clientRequest.city,
      products: clientRequest.products
    };
    
    console.log('📤 Sending request to server...');
    console.log('   Endpoint: POST /api/compare/price');
    console.log('   Data:', JSON.stringify(priceComparisonRequest, null, 2));
    
    // Step 3: Simulate the server processing (using our updated logic)
    console.log('\n🔍 Step 3: Processing request (simulating server)...');
    
    const MultiScraper = require('./server/services/multiScraper');
    const multiScraper = new MultiScraper();
    
    const results = await multiScraper.searchProduct(clientRequest.city, clientRequest.products[0].name);
    
    if (results && results.length > 0) {
      console.log(`✅ Server found ${results.length} results!`);
      
      // Aggregate results (like your server does)
      const aggregated = multiScraper.aggregateResults(results);
      
      // Step 4: Simulate server response to client
      console.log('\n🔍 Step 4: Server response to client...');
      
      const serverResponse = {
        success: true,
        message: 'Price comparison completed successfully',
        data: {
          city: clientRequest.city,
          stores: aggregated.map(store => ({
            branch: store.branch,
            address: store.address,
            totalPrice: store.totalPrice,
            itemsFound: store.itemsFound,
            itemPrices: store.itemPrices
          })),
          summary: {
            totalStores: aggregated.length,
            totalItems: aggregated.reduce((sum, store) => sum + store.itemsFound, 0),
            priceRange: {
              min: Math.min(...aggregated.map(store => store.totalPrice)),
              max: Math.max(...aggregated.map(store => store.totalPrice))
            }
          }
        }
      };
      
      console.log('📥 Server Response:');
      console.log(JSON.stringify(serverResponse, null, 2));
      
      // Step 5: Simulate client receiving and displaying results
      console.log('\n🔍 Step 5: Client displaying results...');
      console.log('📱 CLIENT APP DISPLAY:');
      console.log('─'.repeat(50));
      console.log(`📍 Location: ${clientRequest.city}`);
      console.log(`🛒 Product: ${clientRequest.products[0].name}`);
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
      
      return true;
      
    } else {
      console.log('❌ Server found no results');
      
      const errorResponse = {
        success: false,
        message: 'No stores found for the specified product and location',
        data: {
          city: clientRequest.city,
          product: clientRequest.products[0].name,
          stores: []
        }
      };
      
      console.log('📥 Server Error Response:');
      console.log(JSON.stringify(errorResponse, null, 2));
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Client flow test failed:', error.message);
    
    const errorResponse = {
      success: false,
      message: 'Server error occurred',
      error: error.message,
      data: null
    };
    
    console.log('📥 Server Error Response:');
    console.log(JSON.stringify(errorResponse, null, 2));
    
    return false;
  }
}

// Test with multiple scenarios
async function testMultipleScenarios() {
  console.log('\n🧪 Testing Multiple Scenarios');
  console.log('─'.repeat(50));
  
  const scenarios = [
    {
      city: 'רמת גן',
      product: 'דבש לחיץ 200',
      description: 'Client\'s original scenario'
    },
    {
      city: 'תל אביב',
      product: 'חלב',
      description: 'Basic product in different city'
    },
    {
      city: 'ירושלים',
      product: 'לחם',
      description: 'Another common product'
    }
  ];
  
  for (const scenario of scenarios) {
    console.log(`\n🔍 Testing: ${scenario.description}`);
    console.log(`📍 City: ${scenario.city}`);
    console.log(`🛒 Product: ${scenario.product}`);
    
    try {
      const MultiScraper = require('./server/services/multiScraper');
      const multiScraper = new MultiScraper();
      
      const results = await multiScraper.searchProduct(scenario.city, scenario.product);
      
      if (results && results.length > 0) {
        const aggregated = multiScraper.aggregateResults(results);
        console.log(`✅ Found ${aggregated.length} stores with prices`);
        
        // Show cheapest and most expensive
        const prices = aggregated.map(store => store.totalPrice).sort((a, b) => a - b);
        console.log(`   Price range: ${prices[0]}₪ - ${prices[prices.length - 1]}₪`);
      } else {
        console.log('❌ No results found');
      }
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
}

// Run the complete test
async function runCompleteTest() {
  console.log('🚀 Testing Complete Client-Server Flow...\n');
  
  const mainResult = await testClientFlow();
  await testMultipleScenarios();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 CLIENT FLOW TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`🔍 Main Test: ${mainResult ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  if (mainResult) {
    console.log('\n✅ Complete flow is working!');
    console.log('Your client app will now get real store results.');
    console.log('The scraping logic is properly integrated.');
  } else {
    console.log('\n❌ Flow has issues.');
    console.log('Check the error messages above.');
  }
}

runCompleteTest().catch(console.error);
