// server/scripts/convertGovernmentData.js
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Function to convert government Excel data to JSON
function convertGovernmentExcel() {
  try {
    console.log('🔄 Starting conversion of government Excel file...');
    
    // Read the Excel file (assuming it's in the scripts folder)
    const excelPath = path.join(__dirname, 'instructions_4-53_appendix01inst4-53.xlsx');
    
    if (!fs.existsSync(excelPath)) {
      console.error('❌ Excel file not found! Please place the downloaded file in the scripts folder.');
      console.log('📁 Expected location:', excelPath);
      return;
    }
    
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log(`📊 Found sheet: ${sheetName}`);
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`📋 Total rows in Excel: ${jsonData.length}`);
    
    // Skip header row and transform data
    const transformedProducts = [];
    
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // Skip empty rows
      if (!row || row.length < 4) continue;
      
      // Extract data based on the Hebrew column structure
      // Column A: ברקוד (Barcode) - index 0
      // Column B: מותג (Brand) - index 1  
      // Column C: יצרן (Manufacturer) - index 2
      // Column D: שם מוצר (Product Name) - index 3
      // Column E: מועד עדכון ברקודים (Barcode Update Date) - index 4
      
      const barcode = row[0] ? String(row[0]).trim() : '';
      const brand = row[1] ? String(row[1]).trim() : '';
      const manufacturer = row[2] ? String(row[2]).trim() : '';
      const productName = row[3] ? String(row[3]).trim() : '';
      const updateDate = row[4] ? String(row[4]).trim() : '';
      
      // Skip rows without essential data
      if (!barcode || !productName) continue;
      
      // Create product object matching your schema
      const product = {
        _id: new mongoose.Types.ObjectId(),
        name: productName,
        barcode: barcode,
        img: 'https://via.placeholder.com/100?text=No+Image', // Default placeholder
        count: 0,
        // Additional fields for reference
        brand: brand,
        manufacturer: manufacturer,
        updateDate: updateDate,
        source: 'government_database'
      };
      
      transformedProducts.push(product);
    }
    
    console.log(`✅ Transformed ${transformedProducts.length} products`);
    
    // Save to JSON file
    const outputPath = path.join(__dirname, 'government_products.json');
    fs.writeFileSync(outputPath, JSON.stringify(transformedProducts, null, 2));
    
    console.log(`💾 Saved to: ${outputPath}`);
    console.log(`📊 Sample products:`);
    
    // Show first 3 products as sample
    transformedProducts.slice(0, 3).forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} (Barcode: ${product.barcode})`);
    });
    
    return transformedProducts;
    
  } catch (error) {
    console.error('❌ Error converting Excel file:', error);
    throw error;
  }
}

// Function to validate barcode format
function validateBarcodes(products) {
  console.log('🔍 Validating barcode formats...');
  
  const validBarcodes = [];
  const invalidBarcodes = [];
  
  products.forEach(product => {
    const barcode = product.barcode;
    
    // Check if barcode is numeric and has reasonable length
    if (/^\d+$/.test(barcode) && barcode.length >= 6 && barcode.length <= 13) {
      validBarcodes.push(product);
    } else {
      invalidBarcodes.push(product);
    }
  });
  
  console.log(`✅ Valid barcodes: ${validBarcodes.length}`);
  console.log(`❌ Invalid barcodes: ${invalidBarcodes.length}`);
  
  if (invalidBarcodes.length > 0) {
    console.log('⚠️  Sample invalid barcodes:');
    invalidBarcodes.slice(0, 5).forEach(product => {
      console.log(`   - ${product.name}: "${product.barcode}"`);
    });
  }
  
  return { validBarcodes, invalidBarcodes };
}

// Main execution
if (require.main === module) {
  try {
    const products = convertGovernmentExcel();
    if (products) {
      const validation = validateBarcodes(products);
      console.log('\n🎉 Conversion completed successfully!');
      console.log(`📈 Total products: ${products.length}`);
      console.log(`✅ Valid for import: ${validation.validBarcodes.length}`);
    }
  } catch (error) {
    console.error('❌ Conversion failed:', error);
    process.exit(1);
  }
}

module.exports = { convertGovernmentExcel, validateBarcodes }; 