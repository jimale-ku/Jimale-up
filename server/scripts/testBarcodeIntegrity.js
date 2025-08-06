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

// Test 1: Check for duplicate barcodes
async function testDuplicateBarcodes() {
  console.log('\n🔍 TEST 1: Checking for duplicate barcodes...');
  console.log('=' .repeat(50));
  
  const Product = require('../models/Product');
  
  // Find all barcodes and count occurrences
  const barcodeCounts = await Product.aggregate([
    { $match: { barcode: { $exists: true, $ne: null, $ne: '' } } },
    { $group: { _id: '$barcode', count: { $sum: 1 }, products: { $push: { name: '$name', _id: '$_id' } } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]);
  
  if (barcodeCounts.length === 0) {
    console.log('✅ No duplicate barcodes found!');
    return { success: true, duplicates: [] };
  }
  
  console.log(`❌ Found ${barcodeCounts.length} barcodes with duplicates:`);
  barcodeCounts.forEach((item, index) => {
    console.log(`\n${index + 1}. Barcode: ${item._id} (${item.count} products)`);
    item.products.forEach((product, pIndex) => {
      console.log(`   ${pIndex + 1}. ${product.name} (ID: ${product._id})`);
    });
  });
  
  return { success: false, duplicates: barcodeCounts };
}

// Test 2: Check for products with missing barcodes
async function testMissingBarcodes() {
  console.log('\n🔍 TEST 2: Checking for products with missing barcodes...');
  console.log('=' .repeat(50));
  
  const Product = require('../models/Product');
  
  const productsWithoutBarcodes = await Product.find({
    $or: [
      { barcode: { $exists: false } },
      { barcode: null },
      { barcode: '' },
      { barcode: 'null' }
    ]
  }).select('name _id').lean();
  
  if (productsWithoutBarcodes.length === 0) {
    console.log('✅ All products have barcodes!');
    return { success: true, missing: [] };
  }
  
  console.log(`❌ Found ${productsWithoutBarcodes.length} products without barcodes:`);
  productsWithoutBarcodes.slice(0, 10).forEach((product, index) => {
    console.log(`   ${index + 1}. ${product.name} (ID: ${product._id})`);
  });
  
  if (productsWithoutBarcodes.length > 10) {
    console.log(`   ... and ${productsWithoutBarcodes.length - 10} more`);
  }
  
  return { success: false, missing: productsWithoutBarcodes };
}

// Test 3: Verify barcode format consistency
async function testBarcodeFormats() {
  console.log('\n🔍 TEST 3: Checking barcode format consistency...');
  console.log('=' .repeat(50));
  
  const Product = require('../models/Product');
  
  const products = await Product.find({
    barcode: { $exists: true, $ne: null, $ne: '' }
  }).select('name barcode').lean();
  
  const formatIssues = [];
  const barcodeLengths = {};
  
  products.forEach(product => {
    const barcode = product.barcode.toString();
    const length = barcode.length;
    
    // Count barcode lengths
    barcodeLengths[length] = (barcodeLengths[length] || 0) + 1;
    
    // Check for non-numeric barcodes
    if (!/^\d+$/.test(barcode)) {
      formatIssues.push({
        product: product.name,
        barcode: barcode,
        issue: 'Non-numeric characters'
      });
    }
    
    // Check for very short barcodes (likely errors)
    if (length < 6) {
      formatIssues.push({
        product: product.name,
        barcode: barcode,
        issue: 'Too short (less than 6 digits)'
      });
    }
  });
  
  console.log('📊 Barcode length distribution:');
  Object.keys(barcodeLengths).sort().forEach(length => {
    console.log(`   ${length} digits: ${barcodeLengths[length]} products`);
  });
  
  if (formatIssues.length === 0) {
    console.log('✅ All barcodes have valid formats!');
    return { success: true, issues: [] };
  }
  
  console.log(`\n❌ Found ${formatIssues.length} barcodes with format issues:`);
  formatIssues.slice(0, 10).forEach((issue, index) => {
    console.log(`   ${index + 1}. ${issue.product}: ${issue.barcode} (${issue.issue})`);
  });
  
  return { success: false, issues: formatIssues };
}

// Test 4: Cross-reference with government data
async function testGovernmentDataConsistency() {
  console.log('\n🔍 TEST 4: Cross-referencing with government data...');
  console.log('=' .repeat(50));
  
  try {
    // Load government data
    const governmentDataPath = path.join(__dirname, 'government_products.json');
    if (!fs.existsSync(governmentDataPath)) {
      console.log('⚠️  Government data file not found, skipping this test');
      return { success: true, mismatches: [] };
    }
    
    const governmentProducts = JSON.parse(fs.readFileSync(governmentDataPath, 'utf8'));
    const Product = require('../models/Product');
    
    // Create a map of government barcodes to names
    const govBarcodeMap = new Map();
    governmentProducts.forEach(gov => {
      if (gov.barcode && gov.name) {
        govBarcodeMap.set(gov.barcode.toString(), gov.name);
      }
    });
    
    // Check database products against government data
    const dbProducts = await Product.find({
      barcode: { $exists: true, $ne: null, $ne: '' }
    }).select('name barcode').lean();
    
    const mismatches = [];
    
    dbProducts.forEach(dbProduct => {
      const barcode = dbProduct.barcode.toString();
      const govName = govBarcodeMap.get(barcode);
      
      if (govName && govName !== dbProduct.name) {
        mismatches.push({
          barcode: barcode,
          dbName: dbProduct.name,
          govName: govName
        });
      }
    });
    
    if (mismatches.length === 0) {
      console.log('✅ All barcodes match government data names!');
      return { success: true, mismatches: [] };
    }
    
    console.log(`❌ Found ${mismatches.length} barcode-name mismatches with government data:`);
    mismatches.slice(0, 10).forEach((mismatch, index) => {
      console.log(`   ${index + 1}. Barcode: ${mismatch.barcode}`);
      console.log(`      DB Name: ${mismatch.dbName}`);
      console.log(`      Gov Name: ${mismatch.govName}`);
      console.log('');
    });
    
    return { success: false, mismatches: mismatches };
    
  } catch (error) {
    console.error('❌ Error in government data consistency test:', error);
    return { success: false, mismatches: [], error: error.message };
  }
}

// Test 5: Test barcode search functionality
async function testBarcodeSearch() {
  console.log('\n🔍 TEST 5: Testing barcode search functionality...');
  console.log('=' .repeat(50));
  
  const Product = require('../models/Product');
  
  // Get some sample products with barcodes
  const sampleProducts = await Product.find({
    barcode: { $exists: true, $ne: null, $ne: '' }
  }).select('name barcode').limit(10).lean();
  
  console.log(`📋 Testing barcode search with ${sampleProducts.length} sample products:`);
  
  const searchResults = [];
  
  for (const product of sampleProducts) {
    const barcode = product.barcode.toString();
    
    // Test exact barcode search
    const exactMatch = await Product.findOne({ barcode: barcode }).select('name barcode').lean();
    
    // Test barcode as string search
    const stringMatch = await Product.findOne({ barcode: barcode.toString() }).select('name barcode').lean();
    
    // Test with leading zeros
    const paddedBarcode = barcode.padStart(13, '0');
    const paddedMatch = await Product.findOne({ barcode: paddedBarcode }).select('name barcode').lean();
    
    const result = {
      originalProduct: product,
      exactMatch: exactMatch,
      stringMatch: stringMatch,
      paddedMatch: paddedMatch,
      issues: []
    };
    
    // Check for issues
    if (!exactMatch) {
      result.issues.push('No exact match found');
    } else if (exactMatch.name !== product.name) {
      result.issues.push('Exact match returns different product');
    }
    
    if (!stringMatch) {
      result.issues.push('No string match found');
    }
    
    if (paddedMatch && paddedMatch.name !== product.name) {
      result.issues.push('Padded barcode returns different product');
    }
    
    searchResults.push(result);
    
    console.log(`   ${product.name} (${barcode}): ${result.issues.length === 0 ? '✅' : '❌'} ${result.issues.join(', ') || 'All searches work correctly'}`);
  }
  
  const issues = searchResults.filter(r => r.issues.length > 0);
  
  if (issues.length === 0) {
    console.log('\n✅ All barcode searches work correctly!');
    return { success: true, issues: [] };
  }
  
  console.log(`\n❌ Found ${issues.length} products with search issues`);
  return { success: false, issues: issues };
}

// Main test runner
async function runAllTests() {
  try {
    await connectToDatabase();
    
    console.log('🚀 Starting comprehensive barcode integrity tests...');
    console.log('=' .repeat(60));
    
    const results = {
      duplicateBarcodes: await testDuplicateBarcodes(),
      missingBarcodes: await testMissingBarcodes(),
      barcodeFormats: await testBarcodeFormats(),
      governmentConsistency: await testGovernmentDataConsistency(),
      barcodeSearch: await testBarcodeSearch()
    };
    
    // Summary
    console.log('\n📊 TEST SUMMARY');
    console.log('=' .repeat(60));
    
    const testNames = {
      duplicateBarcodes: 'Duplicate Barcodes',
      missingBarcodes: 'Missing Barcodes', 
      barcodeFormats: 'Barcode Formats',
      governmentConsistency: 'Government Data Consistency',
      barcodeSearch: 'Barcode Search Functionality'
    };
    
    let allPassed = true;
    Object.keys(results).forEach(testKey => {
      const result = results[testKey];
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${testNames[testKey]}`);
      if (!result.success) {
        allPassed = false;
      }
    });
    
    if (allPassed) {
      console.log('\n🎉 ALL TESTS PASSED! Your barcode data is clean and ready for production.');
    } else {
      console.log('\n⚠️  SOME TESTS FAILED! Please review the issues above before deploying.');
      console.log('\n🔧 RECOMMENDED ACTIONS:');
      
      if (!results.duplicateBarcodes.success) {
        console.log('   - Fix duplicate barcodes by updating product names or removing duplicates');
      }
      if (!results.missingBarcodes.success) {
        console.log('   - Add barcodes to products that are missing them');
      }
      if (!results.barcodeFormats.success) {
        console.log('   - Fix barcode format issues (non-numeric, too short)');
      }
      if (!results.governmentConsistency.success) {
        console.log('   - Review barcode-name mismatches with government data');
      }
      if (!results.barcodeSearch.success) {
        console.log('   - Fix barcode search functionality issues');
      }
    }
    
    // Save detailed results to file
    const resultsPath = path.join(__dirname, 'barcode_test_results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Detailed results saved to: ${resultsPath}`);
    
  } catch (error) {
    console.error('❌ Error running tests:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testDuplicateBarcodes,
  testMissingBarcodes,
  testBarcodeFormats,
  testGovernmentDataConsistency,
  testBarcodeSearch
}; 