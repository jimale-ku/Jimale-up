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
    'תה ירוק 100 גרם',
    'סוכר לבן 1 ק"ג',
    'קמח לבן 1 ק"ג',
    'ביצים חומות 6 יחידות',
    'חלב טרה 1% 1 ליטר',
    'לחם שיפון 500 גרם',
    'גבינה לבנה 5% 200 גרם',
    'בשר עוף 1 ק"ג',
    'דג סלמון 300 גרם',
    'ירקות מעורבים 500 גרם',
    'פירות מעורבים 1 ק"ג'
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

// Test regular endpoint
async function testRegularEndpoint(productCount) {
  console.log(`\n🧪 Testing regular endpoint with ${productCount} products...`);
  
  const products = generateTestProducts(productCount);
  const startTime = Date.now();
  
  try {
    const response = await axios.post(`${BASE_URL}/compare/price`, {
      city: TEST_CITY,
      products: products
    }, {
      timeout: 120000 // 2 minutes timeout
    });
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`✅ Regular endpoint completed in ${processingTime}ms`);
    console.log(`📊 Found ${response.data.length} stores`);
    console.log(`📦 Total items processed: ${products.length}`);
    
    return {
      success: true,
      processingTime,
      storesFound: response.data.length,
      productsProcessed: products.length
    };
    
  } catch (error) {
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`❌ Regular endpoint failed after ${processingTime}ms`);
    console.log(`🔍 Error: ${error.response?.data?.error || error.message}`);
    
    return {
      success: false,
      processingTime,
      error: error.response?.data?.error || error.message
    };
  }
}

// Test streaming endpoint
async function testStreamingEndpoint(productCount) {
  console.log(`\n🚀 Testing streaming endpoint with ${productCount} products...`);
  
  const products = generateTestProducts(productCount);
  const startTime = Date.now();
  
  try {
    const response = await axios.post(`${BASE_URL}/compare/price/stream`, {
      city: TEST_CITY,
      products: products
    }, {
      timeout: 300000, // 5 minutes timeout
      responseType: 'stream'
    });
    
    let progressCount = 0;
    let finalResult = null;
    
    response.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'progress') {
              progressCount++;
              console.log(`📊 Progress ${progressCount}: ${data.processed}/${data.total} items (${data.percentage}%)`);
            } else if (data.type === 'complete') {
              finalResult = data;
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (parseError) {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    });
    
    return new Promise((resolve, reject) => {
      response.data.on('end', () => {
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        if (finalResult) {
          console.log(`✅ Streaming completed in ${processingTime}ms`);
          console.log(`📊 Found ${finalResult.stores.length} stores`);
          console.log(`📦 Total items processed: ${finalResult.processedItems}/${finalResult.totalItems}`);
          
          resolve({
            success: true,
            processingTime,
            storesFound: finalResult.stores.length,
            productsProcessed: finalResult.processedItems,
            totalProducts: finalResult.totalItems
          });
        } else {
          reject(new Error('No final result received from streaming'));
        }
      });
      
      response.data.on('error', (error) => {
        reject(error);
      });
    });
    
  } catch (error) {
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`❌ Streaming endpoint failed after ${processingTime}ms`);
    console.log(`🔍 Error: ${error.message}`);
    
    return {
      success: false,
      processingTime,
      error: error.message
    };
  }
}

// Test quick endpoint
async function testQuickEndpoint(productCount) {
  console.log(`\n⚡ Testing quick endpoint with ${productCount} products...`);
  
  const products = generateTestProducts(productCount);
  const startTime = Date.now();
  
  try {
    const response = await axios.post(`${BASE_URL}/compare/price/quick`, {
      city: TEST_CITY,
      products: products
    }, {
      timeout: 60000 // 1 minute timeout
    });
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`✅ Quick endpoint completed in ${processingTime}ms`);
    console.log(`📊 Found ${response.data.stores.length} stores`);
    console.log(`📦 Processed: ${response.data.processedItems}/${response.data.totalItems} items`);
    console.log(`🔄 Is partial: ${response.data.isPartial}`);
    
    return {
      success: true,
      processingTime,
      storesFound: response.data.stores.length,
      productsProcessed: response.data.processedItems,
      totalProducts: response.data.totalItems,
      isPartial: response.data.isPartial
    };
    
  } catch (error) {
    const endTime = Date.now();
    const processingTime = endTime - startTime;
    
    console.log(`❌ Quick endpoint failed after ${processingTime}ms`);
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
  console.log('🧪 Starting Large List Optimization Tests...');
  console.log('📍 Test City:', TEST_CITY);
  
  const testSizes = [10, 25, 50, 75, 100];
  const results = {
    regular: [],
    streaming: [],
    quick: []
  };
  
  for (const size of testSizes) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📦 Testing with ${size} products`);
    console.log(`${'='.repeat(50)}`);
    
    // Test regular endpoint
    const regularResult = await testRegularEndpoint(size);
    results.regular.push({ size, ...regularResult });
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test quick endpoint
    const quickResult = await testQuickEndpoint(size);
    results.quick.push({ size, ...quickResult });
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test streaming endpoint for larger lists
    if (size >= 50) {
      const streamingResult = await testStreamingEndpoint(size);
      results.streaming.push({ size, ...streamingResult });
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 TEST RESULTS SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  console.log('\n🔍 Regular Endpoint Results:');
  results.regular.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.size} items: ${result.success ? `${result.processingTime}ms, ${result.storesFound} stores` : result.error}`);
  });
  
  console.log('\n⚡ Quick Endpoint Results:');
  results.quick.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.size} items: ${result.success ? `${result.processingTime}ms, ${result.storesFound} stores (${result.productsProcessed}/${result.totalProducts})` : result.error}`);
  });
  
  console.log('\n🚀 Streaming Endpoint Results:');
  results.streaming.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.size} items: ${result.success ? `${result.processingTime}ms, ${result.storesFound} stores (${result.productsProcessed}/${result.totalProducts})` : result.error}`);
  });
  
  // Calculate success rates
  const regularSuccess = results.regular.filter(r => r.success).length / results.regular.length * 100;
  const quickSuccess = results.quick.filter(r => r.success).length / results.quick.length * 100;
  const streamingSuccess = results.streaming.length > 0 ? results.streaming.filter(r => r.success).length / results.streaming.length * 100 : 0;
  
  console.log(`\n📈 Success Rates:`);
  console.log(`🔍 Regular: ${regularSuccess.toFixed(1)}%`);
  console.log(`⚡ Quick: ${quickSuccess.toFixed(1)}%`);
  console.log(`🚀 Streaming: ${streamingSuccess.toFixed(1)}%`);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎉 Testing completed!');
  console.log(`${'='.repeat(60)}`);
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



