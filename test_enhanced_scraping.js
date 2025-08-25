// Test enhanced scraping logic
const MultiScraper = require('./server/services/multiScraper');

async function testEnhancedScraping() {
  console.log('🧪 Testing Enhanced Scraping Logic');
  console.log('─'.repeat(50));
  
  const multiScraper = new MultiScraper();
  
  // Test the client's scenario
  const testCity = 'רמת גן';
  const testProduct = 'דבש לחיץ 200';
  
  console.log(`📍 City: ${testCity}`);
  console.log(`🛒 Product: ${testProduct}`);
  console.log('');
  
  // Test 1: Generate search strategies
  console.log('🔍 Test 1: Generated Search Strategies');
  const strategies = multiScraper.generateSearchStrategies(testProduct);
  console.log('Generated strategies:');
  strategies.forEach((strategy, index) => {
    console.log(`  ${index + 1}. "${strategy}"`);
  });
  console.log('');
  
  // Test 2: Try each strategy
  console.log('🔍 Test 2: Testing Each Strategy');
  for (const strategy of strategies.slice(0, 5)) { // Test first 5 strategies
    console.log(`\n🔍 Testing strategy: "${strategy}"`);
    
    try {
      const results = await multiScraper.searchProduct(testCity, strategy);
      
      if (results && results.length > 0) {
        console.log(`✅ Strategy "${strategy}" found ${results.length} results!`);
        results.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.branch} - ${result.address} - ${result.price}₪`);
        });
        return true;
      } else {
        console.log(`❌ Strategy "${strategy}" found no results`);
      }
    } catch (error) {
      console.log(`❌ Strategy "${strategy}" failed: ${error.message}`);
    }
  }
  
  console.log('\n❌ No strategies worked');
  return false;
}

// Test with a simpler product that should work
async function testSimpleProduct() {
  console.log('\n🧪 Testing with Simple Product: "דבש"');
  console.log('─'.repeat(50));
  
  const multiScraper = new MultiScraper();
  const testCity = 'רמת גן';
  const testProduct = 'דבש';
  
  try {
    const results = await multiScraper.searchProduct(testCity, testProduct);
    
    if (results && results.length > 0) {
      console.log(`✅ Simple product test found ${results.length} results!`);
      results.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.branch} - ${result.address} - ${result.price}₪`);
      });
      return true;
    } else {
      console.log('❌ Simple product test found no results');
      return false;
    }
  } catch (error) {
    console.log(`❌ Simple product test failed: ${error.message}`);
    return false;
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Testing Enhanced Scraping Logic...\n');
  
  const enhancedResult = await testEnhancedScraping();
  const simpleResult = await testSimpleProduct();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`🔍 Enhanced Scraping: ${enhancedResult ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`🔍 Simple Product Test: ${simpleResult ? '✅ WORKING' : '❌ FAILED'}`);
  
  if (enhancedResult) {
    console.log('\n✅ Enhanced scraping logic is working!');
    console.log('The client should now be able to find stores for their products.');
  } else if (simpleResult) {
    console.log('\n⚠️ Basic scraping works, but complex product names need improvement.');
    console.log('The issue is with the specific product name format.');
  } else {
    console.log('\n❌ Both tests failed. There might be a fundamental issue with:');
    console.log('   1. Network connectivity to CHP');
    console.log('   2. CHP website changes');
    console.log('   3. Rate limiting or blocking');
  }
}

runTests().catch(console.error);
