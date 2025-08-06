const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Connect to MongoDB
async function connectToDatabase() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// Test specific barcode searches
async function testSpecificBarcodeSearches() {
  console.log('🔍 Testing specific barcode searches...');
  console.log('=' .repeat(50));
  
  const Product = require('../models/Product');
  
  // Test cases - you can modify these with barcodes you want to test
  const testCases = [
    // Add your specific barcodes here
    // Example: '7290000000000',
    // Example: '1234567890123',
  ];
  
  // If no test cases provided, get some random products
  if (testCases.length === 0) {
    console.log('📋 No specific test cases provided, getting random products...');
    const randomProducts = await Product.find({
      barcode: { $exists: true, $ne: null, $ne: '' }
    }).select('name barcode').limit(5).lean();
    
    testCases.push(...randomProducts.map(p => p.barcode.toString()));
  }
  
  console.log(`🧪 Testing ${testCases.length} barcodes:`);
  
  for (const barcode of testCases) {
    console.log(`\n🔍 Testing barcode: ${barcode}`);
    
    // Test 1: Exact barcode search
    const exactMatch = await Product.findOne({ barcode: barcode }).select('name barcode _id').lean();
    
    // Test 2: String barcode search
    const stringMatch = await Product.findOne({ barcode: barcode.toString() }).select('name barcode _id').lean();
    
    // Test 3: Padded barcode search (13 digits)
    const paddedBarcode = barcode.padStart(13, '0');
    const paddedMatch = await Product.findOne({ barcode: paddedBarcode }).select('name barcode _id').lean();
    
    // Test 4: Trimmed barcode search (remove leading zeros)
    const trimmedBarcode = barcode.replace(/^0+/, '');
    const trimmedMatch = await Product.findOne({ barcode: trimmedBarcode }).select('name barcode _id').lean();
    
    // Display results
    console.log(`   Exact match: ${exactMatch ? `✅ ${exactMatch.name}` : '❌ Not found'}`);
    console.log(`   String match: ${stringMatch ? `✅ ${stringMatch.name}` : '❌ Not found'}`);
    console.log(`   Padded match (${paddedBarcode}): ${paddedMatch ? `✅ ${paddedMatch.name}` : '❌ Not found'}`);
    console.log(`   Trimmed match (${trimmedBarcode}): ${trimmedMatch ? `✅ ${trimmedMatch.name}` : '❌ Not found'}`);
    
    // Check for inconsistencies
    const matches = [exactMatch, stringMatch, paddedMatch, trimmedMatch].filter(Boolean);
    const uniqueNames = [...new Set(matches.map(m => m.name))];
    
    if (uniqueNames.length > 1) {
      console.log(`   ⚠️  WARNING: Multiple different products found for this barcode!`);
      uniqueNames.forEach((name, index) => {
        console.log(`      ${index + 1}. ${name}`);
      });
    } else if (matches.length > 0) {
      console.log(`   ✅ Consistent results: ${uniqueNames[0]}`);
    } else {
      console.log(`   ❌ No products found with this barcode`);
    }
  }
}

// Test barcode search by name (reverse lookup)
async function testBarcodeSearchByName() {
  console.log('\n🔍 Testing barcode search by product name...');
  console.log('=' .repeat(50));
  
  const Product = require('../models/Product');
  
  // Get some products with names and barcodes
  const products = await Product.find({
    name: { $exists: true, $ne: null, $ne: '' },
    barcode: { $exists: true, $ne: null, $ne: '' }
  }).select('name barcode').limit(10).lean();
  
  console.log(`📋 Testing ${products.length} products by name:`);
  
  for (const product of products) {
    console.log(`\n🔍 Product: ${product.name}`);
    console.log(`   Expected barcode: ${product.barcode}`);
    
    // Search by name
    const nameMatches = await Product.find({
      name: { $regex: product.name, $options: 'i' }
    }).select('name barcode _id').lean();
    
    if (nameMatches.length === 1) {
      const match = nameMatches[0];
      if (match.barcode === product.barcode) {
        console.log(`   ✅ Name search returns correct barcode`);
      } else {
        console.log(`   ❌ Name search returns wrong barcode: ${match.barcode}`);
      }
    } else if (nameMatches.length > 1) {
      console.log(`   ⚠️  Name search returns ${nameMatches.length} products:`);
      nameMatches.forEach((match, index) => {
        console.log(`      ${index + 1}. ${match.name} (${match.barcode})`);
      });
    } else {
      console.log(`   ❌ Name search returns no products`);
    }
  }
}

// Test your app's API endpoints
async function testAppAPIEndpoints() {
  console.log('\n🔍 Testing app API endpoints...');
  console.log('=' .repeat(50));
  
  const Product = require('../models/Product');
  
  // Get a sample product
  const sampleProduct = await Product.findOne({
    barcode: { $exists: true, $ne: null, $ne: '' }
  }).select('name barcode').lean();
  
  if (!sampleProduct) {
    console.log('❌ No products with barcodes found in database');
    return;
  }
  
  console.log(`📋 Testing with sample product: ${sampleProduct.name} (${sampleProduct.barcode})`);
  
  // Test 1: Products API with search query
  console.log('\n1️⃣ Testing /api/products with search query:');
  const searchResults = await Product.find({
    name: { $regex: sampleProduct.name, $options: 'i' }
  }).select('name barcode').limit(5).lean();
  
  console.log(`   Found ${searchResults.length} products matching "${sampleProduct.name}":`);
  searchResults.forEach((result, index) => {
    console.log(`   ${index + 1}. ${result.name} (${result.barcode})`);
  });
  
  // Test 2: Products API with barcode search
  console.log('\n2️⃣ Testing /api/products with barcode search:');
  const barcodeResults = await Product.find({
    barcode: sampleProduct.barcode
  }).select('name barcode').lean();
  
  console.log(`   Found ${barcodeResults.length} products with barcode "${sampleProduct.barcode}":`);
  barcodeResults.forEach((result, index) => {
    console.log(`   ${index + 1}. ${result.name} (${result.barcode})`);
  });
  
  // Test 3: Check for potential conflicts
  console.log('\n3️⃣ Checking for potential barcode conflicts:');
  const allProductsWithBarcode = await Product.find({
    barcode: sampleProduct.barcode
  }).select('name barcode _id').lean();
  
  if (allProductsWithBarcode.length > 1) {
    console.log(`   ⚠️  WARNING: ${allProductsWithBarcode.length} products share the same barcode!`);
    allProductsWithBarcode.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} (ID: ${product._id})`);
    });
  } else {
    console.log(`   ✅ Only one product found with this barcode`);
  }
}

// Main function
async function runTests() {
  try {
    await connectToDatabase();
    
    console.log('🚀 Starting specific barcode search tests...');
    console.log('=' .repeat(60));
    
    await testSpecificBarcodeSearches();
    await testBarcodeSearchByName();
    await testAppAPIEndpoints();
    
    console.log('\n✅ All tests completed!');
    console.log('\n💡 TIPS FOR TESTING YOUR APP:');
    console.log('   1. Use the barcodes shown above to test in your app');
    console.log('   2. Scan barcodes with your app and verify the correct product appears');
    console.log('   3. Test both exact barcodes and variations (with/without leading zeros)');
    console.log('   4. Check that product names match what you expect');
    console.log('   5. If you find issues, check the detailed test results above');
    
  } catch (error) {
    console.error('❌ Error running tests:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  testSpecificBarcodeSearches,
  testBarcodeSearchByName,
  testAppAPIEndpoints
}; 