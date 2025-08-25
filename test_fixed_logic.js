// Test the fixed logic with alternative scraper fallback
const { searchProductWithFallback } = require('./server/routes/compareRoutes');

async function testFixedLogic() {
  console.log('🧪 Testing Fixed Logic with Alternative Scraper');
  console.log('─'.repeat(50));
  
  // Test the client's scenario
  const testCity = 'רמת גן';
  const testProduct = {
    name: 'דבש לחיץ 200',
    barcode: '123456789'
  };
  
  console.log(`📍 City: ${testCity}`);
  console.log(`🛒 Product: ${testProduct.name}`);
  console.log(`📊 Barcode: ${testProduct.barcode}`);
  console.log('');
  
  try {
    console.log('🔍 Testing fixed logic with alternative scraper fallback...');
    const results = await searchProductWithFallback(testCity, testProduct);
    
    if (results && results.length > 0) {
      console.log(`✅ Fixed logic found ${results.length} results!`);
      
      console.log('\n📋 Results:');
      results.forEach((store, index) => {
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
      console.log('❌ Fixed logic found no results');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Test with different products
async function testMultipleProducts() {
  console.log('\n🧪 Testing Multiple Products with Fixed Logic');
  console.log('─'.repeat(50));
  
  const testCity = 'רמת גן';
  const testProducts = [
    { name: 'דבש לחיץ 200', barcode: '123456789' },
    { name: 'דבש', barcode: '987654321' },
    { name: 'חלב', barcode: '456789123' },
    { name: 'לחם', barcode: '789123456' },
    { name: 'ביצים', barcode: '321654987' }
  ];
  
  for (const product of testProducts) {
    console.log(`\n🔍 Testing: "${product.name}"`);
    
    try {
      const results = await searchProductWithFallback(testCity, product);
      
      if (results && results.length > 0) {
        console.log(`✅ Found ${results.length} stores with prices from ${results.reduce((sum, store) => sum + store.itemsFound, 0)} items`);
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
  console.log('🚀 Testing Fixed Logic with Alternative Scraper...\n');
  
  const mainResult = await testFixedLogic();
  await testMultipleProducts();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 FIXED LOGIC TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`🔍 Main Test: ${mainResult ? '✅ WORKING' : '❌ FAILED'}`);
  
  if (mainResult) {
    console.log('\n✅ Fixed logic is working!');
    console.log('The client should now be able to find stores for their products.');
    console.log('Alternative scraper is providing fallback when CHP fails.');
  } else {
    console.log('\n❌ Fixed logic still has issues.');
    console.log('This might indicate a problem with the alternative scraper.');
  }
}

runTests().catch(console.error);
