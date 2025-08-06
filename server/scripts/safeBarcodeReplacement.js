const fs = require('fs');
const path = require('path');

function loadGovernmentData() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'government_products.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading government data:', error);
    return [];
  }
}

function loadOldProducts() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading old products:', error);
    return [];
  }
}

function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')    // Normalize spaces
    .trim();
}

function findBestMatch(govName, oldProducts) {
  const normalizedGovName = normalizeName(govName);
  
  // Strategy 1: Exact normalized match
  const exactMatch = oldProducts.find(old => 
    normalizeName(old.name) === normalizedGovName
  );
  if (exactMatch) {
    return { product: exactMatch, confidence: 'exact' };
  }
  
  // Strategy 2: Remove size/quantity info and match
  const cleanGovName = normalizedGovName.replace(/\s*\d+[קל]?[גר]?[מ"ל]?.*$/, '').trim();
  
  const sizeMatch = oldProducts.find(old => {
    const cleanOldName = normalizeName(old.name).replace(/\s*\d+[קל]?[גר]?[מ"ל]?.*$/, '').trim();
    return cleanOldName === cleanGovName;
  });
  if (sizeMatch) {
    return { product: sizeMatch, confidence: 'size_removed' };
  }
  
  // Strategy 3: Brand name match (first word)
  const govWords = normalizedGovName.split(' ');
  const govBrand = govWords[0];
  
  const brandMatch = oldProducts.find(old => {
    const oldWords = normalizeName(old.name).split(' ');
    const oldBrand = oldWords[0];
    return govBrand === oldBrand && govBrand.length > 2;
  });
  if (brandMatch) {
    return { product: brandMatch, confidence: 'brand' };
  }
  
  return null;
}

function safeBarcodeReplacement() {
  console.log('🔄 Starting safe barcode replacement process...');
  
  const governmentProducts = loadGovernmentData();
  const oldProducts = loadOldProducts();
  
  console.log(`📊 Data Sources:`);
  console.log(`   - Government products: ${governmentProducts.length}`);
  console.log(`   - Old products with images: ${oldProducts.length}`);
  
  let exactMatches = 0;
  let sizeMatches = 0;
  let brandMatches = 0;
  let noMatches = 0;
  let potentialErrors = 0;
  
  const updatedProducts = [...oldProducts]; // Create a copy
  const matchLog = [];
  const warningLog = [];
  
  for (const govProduct of governmentProducts) {
    if (!govProduct.name || !govProduct.barcode) continue;
    
    const match = findBestMatch(govProduct.name, oldProducts);
    
    if (match) {
      // Find the index of the matched product in the updated array
      const productIndex = updatedProducts.findIndex(p => p._id === match.product._id);
      
      if (productIndex !== -1) {
        // Update the barcode
        updatedProducts[productIndex].barcode = govProduct.barcode;
        updatedProducts[productIndex].source = `updated_${match.confidence}`;
        
        const logEntry = `✅ [${match.confidence.toUpperCase()}] "${govProduct.name}" -> "${match.product.name}" (${govProduct.barcode})`;
        console.log(logEntry);
        matchLog.push(logEntry);
        
        switch (match.confidence) {
          case 'exact': exactMatches++; break;
          case 'size_removed': sizeMatches++; break;
          case 'brand': brandMatches++; break;
        }
        
        // Flag potential errors for manual review
        if (match.confidence === 'brand') {
          potentialErrors++;
          const warningEntry = `⚠️  WARNING: Brand-only match - please verify: "${govProduct.name}" -> "${match.product.name}"`;
          console.log(warningEntry);
          warningLog.push(warningEntry);
        }
      }
    } else {
      noMatches++;
      const noMatchEntry = `❌ No match for: "${govProduct.name}"`;
      console.log(noMatchEntry);
      matchLog.push(noMatchEntry);
    }
  }
  
  console.log('\n🎉 Safe barcode replacement completed!');
  console.log(`📈 Results:`);
  console.log(`   ✅ Exact matches: ${exactMatches}`);
  console.log(`   🔄 Size-removed matches: ${sizeMatches}`);
  console.log(`   ⚠️  Brand-only matches: ${brandMatches} (needs verification)`);
  console.log(`   ❌ No matches: ${noMatches}`);
  console.log(`   ⚠️  Potential errors: ${potentialErrors}`);
  
  // Save results
  const outputPath = path.join(__dirname, 'products_safe_updated.json');
  fs.writeFileSync(outputPath, JSON.stringify(updatedProducts, null, 2));
  console.log(`💾 Saved to: ${outputPath}`);
  
  // Save detailed log
  const logPath = path.join(__dirname, 'barcode_replacement_log.txt');
  const logContent = [
    '=== BARCODE REPLACEMENT LOG ===',
    `Date: ${new Date().toISOString()}`,
    '',
    '📊 SUMMARY:',
    `   ✅ Exact matches: ${exactMatches}`,
    `   🔄 Size-removed matches: ${sizeMatches}`,
    `   ⚠️  Brand-only matches: ${brandMatches}`,
    `   ❌ No matches: ${noMatches}`,
    `   ⚠️  Potential errors: ${potentialErrors}`,
    '',
    '📝 DETAILED MATCHES:',
    ...matchLog,
    '',
    '⚠️  WARNINGS (NEED VERIFICATION):',
    ...warningLog
  ].join('\n');
  
  fs.writeFileSync(logPath, logContent);
  console.log(`📝 Detailed log saved to: ${logPath}`);
  
  // Create a report of potential errors for manual review
  if (potentialErrors > 0) {
    console.log(`\n⚠️  Please manually verify the ${potentialErrors} brand-only matches!`);
    console.log(`📋 Check the log file for details: ${logPath}`);
  }
  
  return {
    exactMatches,
    sizeMatches,
    brandMatches,
    noMatches,
    potentialErrors,
    outputPath,
    logPath
  };
}

// Run the script if called directly
if (require.main === module) {
  safeBarcodeReplacement();
}

module.exports = { safeBarcodeReplacement }; 