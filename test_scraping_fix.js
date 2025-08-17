const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000/api'; // Adjust if your server runs on different port
const TEST_USER = {
  username: `testuser_${Date.now()}`,
  phone: `123456789${Date.now() % 1000}`,
  password: 'testpassword123'
};

// Test data
const TEST_GROUP = {
  name: 'Test Group for Scraping Fix'
};

const TEST_PRODUCTS = [
  { name: 'Milk', barcode: '123456789', quantity: 1 },
  { name: 'Bread', barcode: '987654321', quantity: 1 },
  { name: 'Cheese', barcode: '555666777', quantity: 1 }, // This will be "not found"
  { name: 'Eggs', barcode: '111222333', quantity: 1 }
];

let authToken = null;
let groupId = null;
let listId = null;

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

  // Step 2: Create a test group
  async createGroup() {
    log('👥 Step 2: Creating test group...');
    
    const groupResponse = await makeRequest('POST', '/groups', TEST_GROUP);
    groupId = groupResponse._id;
    log('✅ Group created', { groupId });
  },

  // Step 3: Add products to the group list
  async addProducts() {
    log('📝 Step 3: Adding products to group list...');
    
    for (const product of TEST_PRODUCTS) {
      await makeRequest('POST', `/groups/${groupId}/list/items`, {
        name: product.name,
        barcode: product.barcode,
        quantity: product.quantity
      });
      log(`✅ Added ${product.name} to list`);
    }
  },

  // Step 4: Verify products are in the list
  async verifyInitialList() {
    log('🔍 Step 4: Verifying initial list...');
    
    const summary = await makeRequest('GET', `/groups/${groupId}/list/summary`);
    const currentList = summary.currentList || [];
    
    log(`📊 Initial list has ${currentList.length} items:`, 
      currentList.map(item => `${item.name} (${item.barcode})`));
    
    if (currentList.length !== TEST_PRODUCTS.length) {
      throw new Error(`Expected ${TEST_PRODUCTS.length} items, got ${currentList.length}`);
    }
    
    log('✅ Initial list verification passed');
    return currentList;
  },

  // Step 5: Simulate scraping results (some found, some not found)
  async simulateScraping() {
    log('🔍 Step 5: Simulating scraping results...');
    
    // Get the current list to get the actual item IDs from database
    const summary = await makeRequest('GET', `/groups/${groupId}/list/summary`);
    const currentList = summary.currentList || [];
    
    // Simulate that only Milk and Bread were found at the store
    const foundBarcodes = ['123456789', '987654321']; // Milk and Bread
    const notFoundBarcodes = ['555666777', '111222333']; // Cheese and Eggs
    
    // Get the actual database items that were found
    const boughtProducts = currentList.filter(item => foundBarcodes.includes(item.barcode));
    
    log('✅ Scraping simulation complete', {
      found: boughtProducts.map(p => p.name),
      notFound: currentList.filter(p => notFoundBarcodes.includes(p.barcode)).map(p => p.name)
    });
    
    return boughtProducts;
  },

  // Step 6: Complete the trip (this is where our fix is tested)
  async completeTrip(boughtProducts) {
    log('🛒 Step 6: Completing trip (testing our fix)...');
    
    const tripResponse = await makeRequest('POST', `/groups/${groupId}/list/complete-trip`, {
      store: {
        branch: 'Test Store',
        address: '123 Test Street',
        totalPrice: 25.50
      },
      boughtProducts: boughtProducts
    });
    
    log('✅ Trip completed', {
      itemsBought: tripResponse.itemsBought,
      itemsKept: tripResponse.itemsKept
    });
    
    return tripResponse;
  },

  // Step 7: Verify that "not found" items are still in the list
  async verifyNotFoundItemsPreserved() {
    log('🔍 Step 7: Verifying "not found" items are preserved...');
    
    const summary = await makeRequest('GET', `/groups/${groupId}/list/summary`);
    const currentList = summary.currentList || [];
    
    log(`📊 After trip completion, list has ${currentList.length} items:`, 
      currentList.map(item => `${item.name} (${item.barcode})`));
    
    // Should have 2 items left (Cheese and Eggs - the "not found" ones)
    const expectedNotFoundItems = ['Cheese', 'Eggs'];
    const actualItems = currentList.map(item => item.name);
    
    const allExpectedPresent = expectedNotFoundItems.every(name => 
      actualItems.includes(name)
    );
    
    if (!allExpectedPresent) {
      throw new Error(`Expected items ${expectedNotFoundItems} to be preserved, but got ${actualItems}`);
    }
    
    if (currentList.length !== 2) {
      throw new Error(`Expected 2 "not found" items to remain, but got ${currentList.length}`);
    }
    
    log('✅ "Not found" items preservation test passed');
    return currentList;
  },

  // Step 8: Verify "Last Bought" contains only bought items
  async verifyLastBought() {
    log('🛒 Step 8: Verifying "Last Bought" contains only bought items...');
    
    const summary = await makeRequest('GET', `/groups/${groupId}/list/summary`);
    const lastBought = summary.lastBought || [];
    
    log(`📊 Last bought has ${lastBought.length} items:`, 
      lastBought.map(item => `${item.name} (${item.barcode})`));
    
    // Should have 2 items (Milk and Bread - the bought ones)
    const expectedBoughtItems = ['Milk', 'Bread'];
    const actualBoughtItems = lastBought.map(item => item.name);
    
    const allExpectedBought = expectedBoughtItems.every(name => 
      actualBoughtItems.includes(name)
    );
    
    if (!allExpectedBought) {
      throw new Error(`Expected bought items ${expectedBoughtItems}, but got ${actualBoughtItems}`);
    }
    
    if (lastBought.length !== 2) {
      throw new Error(`Expected 2 bought items, but got ${lastBought.length}`);
    }
    
    log('✅ "Last Bought" verification passed');
    return lastBought;
  },

  // Step 9: Test that we can search again with the preserved items
  async testSearchAgain() {
    log('🔍 Step 9: Testing search again with preserved items...');
    
    const summary = await makeRequest('GET', `/groups/${groupId}/list/summary`);
    const currentList = summary.currentList || [];
    
    // Simulate another search with the preserved items
    const productsForSearch = currentList.map(item => ({
      barcode: item.barcode,
      name: item.name,
      quantity: item.quantity || 1
    }));
    
    log('✅ Search test passed - items are available for another search', {
      itemsForNextSearch: productsForSearch.map(p => p.name)
    });
    
    return productsForSearch;
  }
};

// Main test execution
async function runTest() {
  log('🚀 Starting scraping fix test...');
  
  try {
    await testSteps.login();
    await testSteps.createGroup();
    await testSteps.addProducts();
    await testSteps.verifyInitialList();
    
    const boughtProducts = await testSteps.simulateScraping();
    await testSteps.completeTrip(boughtProducts);
    
    await testSteps.verifyNotFoundItemsPreserved();
    await testSteps.verifyLastBought();
    await testSteps.testSearchAgain();
    
    log('🎉 ALL TESTS PASSED! The fix is working correctly.');
    log('✅ Summary:');
    log('   - "Not found" items are preserved in the database');
    log('   - Only bought items are moved to "Last Bought"');
    log('   - Users can search again without losing "not found" items');
    
  } catch (error) {
    log('❌ TEST FAILED!', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runTest().catch(error => {
    log('💥 Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { testSteps, runTest };
