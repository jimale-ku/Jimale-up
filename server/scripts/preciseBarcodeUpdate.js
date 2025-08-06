const fs = require('fs');
const path = require('path');

// Better normalization that preserves Hebrew characters
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^\w\s\u0590-\u05FF]/g, '') // Keep Hebrew characters (Unicode range 0590-05FF)
    .replace(/\s+/g, ' ')    // Normalize multiple spaces to single space
    .trim();
}

// Find exact match using normalized names
function findExactMatch(govName, products) {
  const normalizedGovName = normalizeName(govName);
  
  // Skip if normalized name is too short (likely a false match)
  if (normalizedGovName.length < 3) {
    return null;
  }
  
  // Find exact normalized match
  const match = products.find(product => 
    normalizeName(product.name) === normalizedGovName
  );
  
  return match;
}

// Load data files
function loadGovernmentData() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'government_products.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading government data:', error);
    return [];
  }
}

function loadProducts() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading products:', error);
    return [];
  }
}

// Main function to perform precise barcode updates
function preciseBarcodeUpdate() {
  console.log('🎯 Starting PRECISE barcode update process...');
  console.log('=' .repeat(60));
  
  const governmentProducts = loadGovernmentData();
  const products = loadProducts();
  
  console.log(`📊 Data Sources:`);
  console.log(`   - Government products: ${governmentProducts.length}`);
  console.log(`   - Products with images: ${products.length}`);
  
  let exactMatches = 0;
  let noMatches = 0;
  let skippedItems = 0;
  
  const updatedProducts = [...products]; // Create a copy
  const matchLog = [];
  const noMatchLog = [];
  const skippedLog = [];
  
  console.log('\n🔍 Processing government products...');
  console.log('=' .repeat(60));
  
  for (const govProduct of governmentProducts) {
    if (!govProduct.name || !govProduct.barcode) {
      skippedItems++;
      skippedLog.push({
        reason: 'Missing name or barcode',
        govProduct: govProduct
      });
      continue;
    }
    
    // Skip if barcode is not numeric or too short
    const barcode = govProduct.barcode.toString();
    if (!/^\d+$/.test(barcode) || barcode.length < 6) {
      skippedItems++;
      skippedLog.push({
        reason: 'Invalid barcode format',
        govProduct: govProduct,
        barcode: barcode
      });
      continue;
    }
    
    const match = findExactMatch(govProduct.name, products);
    
    if (match) {
      // Find the index of the matched product in the updated array
      const productIndex = updatedProducts.findIndex(p => p._id === match._id);
      
      if (productIndex !== -1) {
        // Check if this barcode is already used by another product
        const existingProductWithBarcode = updatedProducts.find(p => 
          p.barcode === govProduct.barcode && p._id !== match._id
        );
        
        if (existingProductWithBarcode) {
          skippedItems++;
          skippedLog.push({
            reason: 'Barcode already used by another product',
            govProduct: govProduct,
            existingProduct: existingProductWithBarcode.name,
            matchedProduct: match.name
          });
          continue;
        }
        
        // Update the barcode
        updatedProducts[productIndex].barcode = govProduct.barcode;
        
        exactMatches++;
        matchLog.push({
          govName: govProduct.name,
          govBarcode: govProduct.barcode,
          productName: match.name,
          oldBarcode: match.barcode,
          newBarcode: govProduct.barcode
        });
        
        console.log(`✅ ${exactMatches}. "${govProduct.name}" → "${match.name}" (${match.barcode} → ${govProduct.barcode})`);
      }
    } else {
      noMatches++;
      noMatchLog.push({
        govName: govProduct.name,
        govBarcode: govProduct.barcode,
        normalizedName: normalizeName(govProduct.name)
      });
    }
  }
  
  // Summary
  console.log('\n📊 UPDATE SUMMARY');
  console.log('=' .repeat(60));
  console.log(`✅ Exact matches found: ${exactMatches}`);
  console.log(`❌ No matches found: ${noMatches}`);
  console.log(`⚠️  Skipped items: ${skippedItems}`);
  console.log(`📦 Total products processed: ${governmentProducts.length}`);
  
  // Save results
  const resultsPath = path.join(__dirname, 'products_precise_updated.json');
  fs.writeFileSync(resultsPath, JSON.stringify(updatedProducts, null, 2));
  
  // Save detailed logs
  const matchLogPath = path.join(__dirname, 'precise_update_log.json');
  fs.writeFileSync(matchLogPath, JSON.stringify({
    summary: {
      exactMatches,
      noMatches,
      skippedItems,
      totalProcessed: governmentProducts.length
    },
    matches: matchLog,
    noMatches: noMatchLog,
    skipped: skippedLog
  }, null, 2));
  
  console.log(`\n💾 Files saved:`);
  console.log(`   - Updated products: ${resultsPath}`);
  console.log(`   - Detailed log: ${matchLogPath}`);
  
  // Show sample of matches
  if (matchLog.length > 0) {
    console.log('\n📋 Sample matches (first 10):');
    console.log('=' .repeat(60));
    matchLog.slice(0, 10).forEach((match, index) => {
      console.log(`${index + 1}. "${match.govName}"`);
      console.log(`   → "${match.productName}"`);
      console.log(`   → Barcode: ${match.oldBarcode} → ${match.newBarcode}`);
      console.log('');
    });
  }
  
  // Show sample of no matches
  if (noMatchLog.length > 0) {
    console.log('\n❌ Sample no matches (first 10):');
    console.log('=' .repeat(60));
    noMatchLog.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. "${item.govName}" (${item.govBarcode})`);
      console.log(`   Normalized: "${item.normalizedName}"`);
      console.log('');
    });
  }
  
  // Show sample of skipped items
  if (skippedLog.length > 0) {
    console.log('\n⚠️  Sample skipped items (first 10):');
    console.log('=' .repeat(60));
    skippedLog.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. "${item.govProduct.name}" - ${item.reason}`);
      if (item.existingProduct) {
        console.log(`   Conflicts with: "${item.existingProduct}"`);
      }
      console.log('');
    });
  }
  
  console.log('\n🎉 Precise barcode update completed!');
  console.log('\n🔍 Next steps:');
  console.log('   1. Review the sample matches above');
  console.log('   2. Check the detailed log file');
  console.log('   3. Run integrity tests on the updated data');
  console.log('   4. Test a few barcodes manually');
  console.log('   5. If satisfied, populate the database');
  
  return {
    success: true,
    exactMatches,
    noMatches,
    skippedItems,
    updatedProducts
  };
}

// Test function to show what matches would be made
function testMatching() {
  console.log('🧪 Testing matching logic...');
  console.log('=' .repeat(60));
  
  const governmentProducts = loadGovernmentData();
  const products = loadProducts();
  
  console.log(`📊 Testing with ${governmentProducts.length} government products and ${products.length} products`);
  
  let testMatches = 0;
  let testNoMatches = 0;
  
  console.log('\n📋 Sample matching results (first 20):');
  console.log('=' .repeat(60));
  
  for (let i = 0; i < Math.min(20, governmentProducts.length); i++) {
    const govProduct = governmentProducts[i];
    
    if (!govProduct.name || !govProduct.barcode) continue;
    
    const match = findExactMatch(govProduct.name, products);
    
    if (match) {
      testMatches++;
      console.log(`✅ "${govProduct.name}" → "${match.name}"`);
      console.log(`   Barcode: ${match.barcode} → ${govProduct.barcode}`);
      console.log(`   Normalized: "${normalizeName(govProduct.name)}"`);
      console.log('');
    } else {
      testNoMatches++;
      console.log(`❌ "${govProduct.name}" → NO MATCH`);
      console.log(`   Normalized: "${normalizeName(govProduct.name)}"`);
      console.log('');
    }
  }
  
  console.log(`📊 Test Results: ${testMatches} matches, ${testNoMatches} no matches`);
  console.log('\n💡 If the matches look correct, run the full update process.');
  
  return { testMatches, testNoMatches };
}

// Run if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    testMatching();
  } else {
    preciseBarcodeUpdate();
  }
}

module.exports = {
  preciseBarcodeUpdate,
  testMatching,
  normalizeName,
  findExactMatch
}; 