// Test alternative scraper
const AlternativeScraper = require('./server/services/alternativeScraper');

async function testAlternativeScraper() {
  console.log('🧪 Testing Alternative Scraper');
  console.log('─'.repeat(50));
  
  const scraper = new AlternativeScraper();
  
  // Test the client's scenario
  const testCity = 'רמת גן';
  const testProduct = 'דבש לחיץ 200';
  
  console.log(`📍 City: ${testCity}`);
  console.log(`🛒 Product: ${testProduct}`);
  console.log('');
  
  try {
    const results = await scraper.searchProduct(testCity, testProduct);
    
    if (results && results.length > 0) {
      console.log(`✅ Alternative scraper found ${results.length} results!`);
      
      // Aggregate results
      const aggregated = scraper.aggregateResults(results);
      
      console.log('\n📋 Aggregated Results:');
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
    console.error('❌ Alternative scraper test failed:', error.message);
    return false;
  }
}

// Test with different products
async function testMultipleProducts() {
  console.log('\n🧪 Testing Multiple Products');
  console.log('─'.repeat(50));
  
  const scraper = new AlternativeScraper();
  const testCity = 'רמת גן';
  const testProducts = [
    'דבש לחיץ 200',
    'חלב',
    'לחם',
    'ביצים',
    'שמן זית'
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
  console.log('🚀 Testing Alternative Scraper...\n');
  
  const mainResult = await testAlternativeScraper();
  await testMultipleProducts();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 ALTERNATIVE SCRAPER SUMMARY');
  console.log('='.repeat(60));
  console.log(`🔍 Main Test: ${mainResult ? '✅ WORKING' : '❌ FAILED'}`);
  
  if (mainResult) {
    console.log('\n✅ Alternative scraper is working!');
    console.log('This can be used as a fallback when CHP is blocked.');
    console.log('The client should now be able to find stores for their products.');
  } else {
    console.log('\n❌ Alternative scraper failed.');
    console.log('Consider using mock data for testing purposes.');
  }
}

runTests().catch(console.error);
