const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function debugRoutes() {
  console.log('🔍 Debugging available routes...');
  
  const routes = [
    '/auth/login',
    '/compare/price',
    '/products',
    '/groups',
    '/list'
  ];
  
  for (const route of routes) {
    try {
      console.log(`\n📡 Testing ${route}...`);
      
      if (route === '/auth/login') {
        // Test POST for login
        const response = await axios.post(`${BASE_URL}${route}`, {
          identifier: 'test',
          password: 'test'
        });
        console.log(`✅ ${route} - Status: ${response.status}`);
      } else if (route === '/compare/price') {
        // Test POST for compare
        const response = await axios.post(`${BASE_URL}${route}`, {
          city: 'test',
          products: [{ name: 'test', barcode: '123', quantity: 1 }]
        });
        console.log(`✅ ${route} - Status: ${response.status}`);
      } else {
        // Test GET for other routes
        const response = await axios.get(`${BASE_URL}${route}`);
        console.log(`✅ ${route} - Status: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`❌ ${route} - Status: ${error.response?.status || 'No response'}`);
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
    }
  }
}

debugRoutes();

