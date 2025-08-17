#!/usr/bin/env node

const { runTest } = require('./test_scraping_fix');

console.log('🧪 Running Scraping Fix Test');
console.log('=============================');

// Check if server is running
const checkServer = async () => {
  try {
    const axios = require('axios');
    await axios.get('http://localhost:3001/api/health', { timeout: 5000 });
    console.log('✅ Server is running on port 3001');
    return true;
  } catch (error) {
    console.log('❌ Server is not running on port 3001');
    console.log('Please start your server first with: npm start');
    return false;
  }
};

// Main execution
async function main() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    process.exit(1);
  }
  
  console.log('\n🚀 Starting test...\n');
  
  try {
    await runTest();
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.log('\n❌ Test failed!');
    console.log('Error:', error.message);
    process.exit(1);
  }
}

main();
