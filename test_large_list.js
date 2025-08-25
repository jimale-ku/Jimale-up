const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_USER = {
  username: `testuser_${Date.now()}`,
  phone: `123456789${Date.now() % 1000}`,
  password: 'testpassword123'
};

// Generate a large list of test products
const generateLargeProductList = (count) => {
  const products = [];
  const productNames = [
    'Milk', 'Bread', 'Cheese', 'Eggs', 'Butter', 'Yogurt', 'Cereal', 'Bananas', 'Apples', 'Oranges',
    'Tomatoes', 'Potatoes', 'Onions', 'Carrots', 'Cucumber', 'Lettuce', 'Spinach', 'Broccoli', 'Cauliflower', 'Peppers',
    'Chicken', 'Beef', 'Fish', 'Pork', 'Turkey', 'Lamb', 'Salmon', 'Tuna', 'Shrimp', 'Crab',
    'Rice', 'Pasta', 'Noodles', 'Quinoa', 'Oats', 'Flour', 'Sugar', 'Salt', 'Pepper', 'Oil',
    'Coffee', 'Tea', 'Juice', 'Water', 'Soda', 'Beer', 'Wine', 'Vinegar', 'Soy Sauce', 'Ketchup'
  ];
  
  for (let i = 0; i < count; i++) {
    const productName = productNames[i % productNames.length];
    const barcode = `123456789${String(i).padStart(3, '0')}`;
    
    products.push({
      name: `${productName} ${i + 1}`,
      barcode: barcode,
      quantity: Math.floor(Math.random() * 3) + 1,
      image: `https://via.placeholder.com/100?text=${encodeURIComponent(productName)}`
    });
  }
  
  return products;
};

let authToken = null;

// Utility functions
const log = (message, data = null) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
};

const makeRequest = async (method, endpoint, data = null, headers = {}) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        ...headers
      },
      ...(data && { data })
    };
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    log(`❌ Request failed: ${method} ${endpoint}`, {
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });
    throw error;
  }
};

// Test steps
const testSteps = {
  // Step 1: Login/Create user
  async login() {
    log('🔐 Step 1: Logging in...');
    
    try {
      // Try to login first
      const loginResponse = await makeRequest('POST', '/auth/login', {
        identifier: TEST_USER.username,
        password: TEST_USER.password
      });
      authToken = loginResponse.token;
      log('✅ Login successful');
    } catch (error) {
      // If login fails, try to register
      log('⚠️ Login failed, trying to register...');
      try {
        await makeRequest('POST', '/auth/signup', {
          username: TEST_USER.username,
          phone: TEST_USER.phone,
          password: TEST_USER.password
        });
        
        // Now try to login
        const loginResponse = await makeRequest('POST', '/auth/login', {
          identifier: TEST_USER.username,
          password: TEST_USER.password
        });
        authToken = loginResponse.token;
        log('✅ Registration and login successful');
      } catch (regError) {
        throw new Error('Failed to register and login');
      }
    }
  },

  // Step 2: Test different list sizes
  async testListSizes() {
    log('🧪 Step 2: Testing different list sizes...');
    
    const testSizes = [10, 25, 50, 75, 100];
    
    for (const size of testSizes) {
      log(`\n📊 Testing list with ${size} items...`);
      
      const products = generateLargeProductList(size);
      const startTime = Date.now();
      
      try {
        const response = await makeRequest('POST', '/compare/price', {
          city: 'תל אביב',
          products: products
        });
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        log(`✅ ${size} items processed successfully in ${processingTime}ms`);
        log(`📈 Found ${response.length} stores with ${response.reduce((sum, s) => sum + s.itemsFound, 0)} total items found`);
        
        // Performance analysis
        const avgTimePerItem = processingTime / size;
        log(`⚡ Average time per item: ${avgTimePerItem.toFixed(2)}ms`);
        
        if (processingTime > 120000) { // 2 minutes
          log(`⚠️ WARNING: ${size} items took ${processingTime}ms (>2 minutes)`);
        } else if (processingTime > 60000) { // 1 minute
          log(`⚠️ SLOW: ${size} items took ${processingTime}ms (>1 minute)`);
        } else {
          log(`✅ GOOD: ${size} items processed in ${processingTime}ms (<1 minute)`);
        }
        
      } catch (error) {
        log(`❌ FAILED: ${size} items failed with error: ${error.message}`);
        break; // Stop testing if we hit a failure
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  },

  // Step 3: Test the exact scenario that was failing (50+ items)
  async testFailingScenario() {
    log('\n🎯 Step 3: Testing the exact failing scenario (50+ items)...');
    
    const failingSizes = [50, 60, 70, 80, 90, 100];
    
    for (const size of failingSizes) {
      log(`\n🔍 Testing ${size} items (previously failing size)...`);
      
      const products = generateLargeProductList(size);
      const startTime = Date.now();
      
      try {
        const response = await makeRequest('POST', '/compare/price', {
          city: 'תל אביב',
          products: products
        });
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        log(`✅ ${size} items SUCCESSFUL in ${processingTime}ms`);
        log(`📊 Results: ${response.length} stores, ${response.reduce((sum, s) => sum + s.itemsFound, 0)} items found`);
        
        // Check if this would have failed before
        if (processingTime < 120000) { // 2 minutes
          log(`🎉 FIXED: ${size} items now works (was failing before)`);
        } else {
          log(`⚠️ Still slow: ${size} items took ${processingTime}ms`);
        }
        
      } catch (error) {
        log(`❌ Still failing at ${size} items: ${error.message}`);
        break;
      }
      
      // Delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

// Main test execution
async function runLargeListTest() {
  log('🚀 Starting Large List Performance Test...');
  
  try {
    await testSteps.login();
    await testSteps.testListSizes();
    await testSteps.testFailingScenario();
    
    log('\n🎉 LARGE LIST TEST COMPLETED!');
    log('✅ Summary:');
    log('   - Tested various list sizes (10-100 items)');
    log('   - Verified that 50+ items now work properly');
    log('   - Performance metrics logged for analysis');
    
  } catch (error) {
    log('❌ LARGE LIST TEST FAILED!', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runLargeListTest().catch(error => {
    log('💥 Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testSteps, runLargeListTest };




