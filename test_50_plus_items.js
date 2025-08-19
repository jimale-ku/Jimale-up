const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
const TEST_CITY = 'תל אביב';

// Generate test products
function generateTestProducts(count) {
  const products = [];
  const productNames = [
    'חלב טרה 3% 1 ליטר',
    'לחם אחידם 750 גרם',
    'ביצים גדולות 12 יחידות',
    'בשר טחון 500 גרם',
    'גבינה צהובה 200 גרם',
    'יוגורט דנונה 150 גרם',
    'מים מינרליים 1.5 ליטר',
    'שמן זית 500 מ"ל',
    'קפה שחור 200 גרם',
    'תה ירוק 100 גרם'
  ];

  for (let i = 0; i < count; i++) {
    const productName = productNames[i % productNames.length];
    const barcode = `729000000000${i + 1}`.padStart(13, '0');
    
    products.push({
      barcode: barcode,
      name: productName,
      quantity: 1,
      image: null
    });
  }
  
  return products;
}

// Test function
async function testLargeList(itemCount) {
  console.log(`\n🧪 Testing with ${itemCount} items...`);
  console.log('='.repeat(50));
  
  const products = generateTestProducts(itemCount);
  const startTime = Date.now();
  
  try {
    console.log(`📡 Sending request to server...`);
    
    const response = await axios.post(`${BASE_URL}/compare/price`, {
      city: TEST_CITY,
      products: products
    }, {
      timeout: 300000 // 5 minutes timeout
    });
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`✅ SUCCESS! Processing completed in ${processingTime}ms`);
    console.log(`📊 Found ${response.data.length} stores`);
    console.log(`📦 Total items processed: ${products.length}`);
    
    if (response.data.length > 0) {
      console.log(`🏪 Top store: ${response.data[0].branch} (${response.data[0].itemsFound} items found)`);
    }
    
    return {
      success: true,
      processingTime,
      storesFound: response.data.length,
      itemsProcessed: products.length
    };
    
  } catch (error) {
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`❌ FAILED after ${processingTime}ms`);
    console.log(`🔍 Error: ${error.response?.data?.error || error.message}`);
    
    return {
      success: false,
      processingTime,
      error: error.response?.data?.error || error.message
    };
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Testing Large List Scraping Logic');
  console.log('📍 Test City:', TEST_CITY);
  console.log('🎯 Goal: Verify 50+ items can be processed');
  
  const testSizes = [30, 50, 75, 100];
  const results = [];
  
  for (const size of testSizes) {
    const result = await testLargeList(size);
    results.push({ size, ...result });
    
    // Wait between tests
    if (size < 100) {
      console.log('\n⏳ Waiting 3 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const time = `${result.processingTime}ms`;
    const stores = result.success ? `${result.storesFound} stores` : 'N/A';
    
    console.log(`${status} ${result.size} items: ${time}, ${stores}`);
    
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  // Calculate success rate
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  const successRate = (successCount / totalCount) * 100;
  
  console.log(`\n📈 Success Rate: ${successRate.toFixed(1)}% (${successCount}/${totalCount})`);
  
  if (successRate === 100) {
    console.log('🎉 ALL TESTS PASSED! Your scraping logic can handle 50+ items!');
  } else if (successRate >= 75) {
    console.log('👍 MOST TESTS PASSED! Your scraping logic is working well!');
  } else {
    console.log('⚠️ Some tests failed. Check the errors above.');
  }
  
  console.log('\n' + '='.repeat(60));
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${BASE_URL.replace('/api', '')}/health`, { timeout: 5000 });
    console.log('✅ Server is running');
    return true;
  } catch (error) {
    console.log('❌ Server is not running. Please start the server first:');
    console.log('   cd server && npm start');
    return false;
  }
}

// Run the tests
async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }
  
  try {
    await runTests();
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
