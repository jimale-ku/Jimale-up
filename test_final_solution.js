// Test the final solution with alternative scraper
const AlternativeScraper = require('./server/services/alternativeScraper');

async function testFinalSolution() {
  console.log('🧪 Testing Final Solution with Alternative Scraper');
  console.log('─'.repeat(50));
  
  const scraper = new AlternativeScraper();
  
  // Test the client's scenario
  const testCity = 'רמת גן';
  const testProduct = 'דבש לחיץ 200';
  
  console.log(`📍 City: ${testCity}`);
  console.log(`🛒 Product: ${testProduct}`);
  console.log('');
  
  try {
    console.log('🔍 Testing alternative scraper...');
    const results = await scraper.searchProduct(testCity, testProduct);
    
    if (results && results.length > 0) {
      console.log(`✅ Alternative scraper found ${results.length} results!`);
      
      // Aggregate results
      const aggregated = scraper.aggregateResults(results);
      
      console.log('\n📋 Results:');
      aggregated.forEach((store, index) => {
        console.log(`\n🏪 Store ${index + 1}: ${store.branch}`);
        console.log(`📍 Address: ${store.address}`);
        console.log(`💰 Total Price: ${store.totalPrice}₪`);
        console.log(`📦 Items Found: ${store.itemsFound}`);
        
        // Show individual product prices
        Object.entries(store.itemPrices).forEach(([product, price]) => {
          console.log(`   • ${product}: ${price}₪`);
        });
      });
      
      return true;
    } else {
      console.log('❌ Alternative scraper found no results');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test with different products
async function testMultipleProducts() {
  console.log('\n🧪 Testing Multiple Products with Alternative Scraper');
  console.log('─'.repeat(50));
  
  const scraper = new AlternativeScraper();
  const testCity = 'רמת גן';
  const testProducts = [
    'דבש לחיץ 200',
    'דבש',
    'חלב',
    'לחם',
    'ביצים'
  ];
  
  for (const product of testProducts) {
    console.log(`\n🔍 Testing: "${product}"`);
    
    try {
      const results = await scraper.searchProduct(testCity, product);
      
      if (results && results.length > 0) {
        const aggregated = scraper.aggregateResults(results);
        console.log(`✅ Found ${aggregated.length} stores with prices from ${aggregated.reduce((sum, store) => sum + store.itemsFound, 0)} items`);
      } else {
        console.log('❌ No results found');
      }
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Testing Final Solution...\n');
  
  const mainResult = await testFinalSolution();
  await testMultipleProducts();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 FINAL SOLUTION SUMMARY');
  console.log('='.repeat(60));
  console.log(`🔍 Main Test: ${mainResult ? '✅ WORKING' : '❌ FAILED'}`);
  
  if (mainResult) {
    console.log('\n✅ Final solution is working!');
    console.log('The client should now be able to find stores for their products.');
    console.log('Alternative scraper is providing reliable results when CHP fails.');
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('1. Start your server: npm start (in server directory)');
    console.log('2. Test the client app with the same scenario');
    console.log('3. The client should now get store results!');
  } else {
    console.log('\n❌ Final solution still has issues.');
    console.log('This might indicate a problem with the alternative scraper implementation.');
  }
}

runTests().catch(console.error);
