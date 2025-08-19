const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testCompareRoute() {
  console.log('🧪 Testing compare route...');
  
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
    
    console.log('✅ Compare route working!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.log('❌ Compare route failed:');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.message || error.message);
    
    // Try to get more info about the error
    if (error.response?.data) {
      console.log('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testCompareRoute();

