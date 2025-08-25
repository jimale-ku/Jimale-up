const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testRouteStructure() {
  console.log('🧪 Testing route structure...');
  
  try {
    // Test with minimal data
    const response = await axios.post(`${BASE_URL}/compare/price`, {
      city: 'תל אביב',
      products: [
        {
          name: 'חלב',
          barcode: '123456789',
          quantity: 1
        }
      ]
    });
    
    console.log('✅ Route structure working!');
    console.log('Status:', response.status);
    console.log('Response length:', response.data?.length || 'No data');
    
  } catch (error) {
    console.log('❌ Route structure failed:');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.message || error.message);
    
    // Check if it's a 404 with fallback message (which means route is working)
    if (error.response?.status === 404 && error.response?.data?.fallback) {
      console.log('✅ Route is working! The 404 is expected because no stores found.');
      console.log('This means the route structure is correct.');
    }
  }
}

testRouteStructure();




