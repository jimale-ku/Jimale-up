const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testEndpoint() {
  console.log('🧪 Testing /compare/price endpoint...');
  
  try {
    const response = await axios.post(`${BASE_URL}/compare/price`, {
      city: 'תל אביב',
      products: [
        {
          name: 'Test Product',
          barcode: '123456789',
          quantity: 1
        }
      ]
    });
    
    console.log('✅ Endpoint working!');
    console.log('Response:', response.data);
    
  } catch (error) {
    console.log('❌ Endpoint failed:');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.message || error.message);
    console.log('URL:', error.config?.url);
  }
}

testEndpoint();
