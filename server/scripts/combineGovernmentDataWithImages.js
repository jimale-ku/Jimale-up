// server/scripts/combineGovernmentDataWithImages.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const fs = require('fs');
const XLSX = require('xlsx');

// Function to load old products data with images
function loadOldProductsWithImages() {
  try {
    console.log('📂 Loading old products data with images...');
    const oldProductsPath = path.join(__dirname, 'products.json');
    
    if (!fs.existsSync(oldProductsPath)) {
      console.error('❌ Old products.json not found!');
      return [];
    }
    
    const oldProductsData = fs.readFileSync(oldProductsPath, 'utf8');
    const oldProducts = JSON.parse(oldProductsData);
    
    // Filter only products that have valid images
    const productsWithImages = oldProducts.filter(product => 
      product.img && 
      product.img !== 'null' && 
      product.img !== '' &&
      product.img !== 'https://via.placeholder.com/100?text=No+Image'
    );
    
    console.log(`✅ Loaded ${productsWithImages.length} old products with valid images`);
    return productsWithImages;
    
  } catch (error) {
    console.error('❌ Error loading old products:', error);
    return [];
  }
}

// Function to load government data from Excel
function loadGovernmentData() {
  try {
    console.log('📊 Loading government data from Excel...');
    
    const excelPath = path.join(__dirname, 'instructions_4-53_appendix01inst4-53.xlsx');
    
    if (!fs.existsSync(excelPath)) {
      console.error('❌ Government Excel file not found!');
      return [];
    }
    
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log(`📋 Found sheet: ${sheetName}`);
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`📊 Total rows in Excel: ${jsonData.length}`);
    
    // Skip header row and transform data
    const governmentProducts = [];
    
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
      
      governmentProducts.push({
        barcode: barcode,
        name: productName,
        brand: brand,
        manufacturer: manufacturer,
        updateDate: updateDate
      });
    }
    
    console.log(`✅ Loaded ${governmentProducts.length} government products`);
    return governmentProducts;
    
  } catch (error) {
    console.error('❌ Error loading government data:', error);
    return [];
  }
}

// Function to find matching image from old data (strict exact name match only)
function findMatchingImageByNameStrict(productName, oldProducts) {
  const normalizedName = productName.toLowerCase().replace(/[^\w\s]/g, '').trim();

  // Only assign image if exact match
  const exactMatch = oldProducts.find(old =>
    old.name && old.name.toLowerCase().replace(/[^\w\s]/g, '').trim() === normalizedName && old.img
  );
  if (exactMatch) {
    console.log(`✅ [EXACT] Matched: '${productName}' <-> '${exactMatch.name}'`);
    return exactMatch.img;
  }
  console.log(`❌ No exact image match for: '${productName}'`);
  return null;
}

// Function to combine government data with images
function combineGovernmentDataWithImages() {
  return new Promise((resolve, reject) => {
    try {
      console.log('🔄 Starting data combination process...');
      
      // Load both data sources
      const governmentProducts = loadGovernmentData();
      const oldProducts = loadOldProductsWithImages();
      
      if (governmentProducts.length === 0) {
        console.error('❌ No government data available');
        reject(new Error('No government data available'));
        return;
      }
      
      if (oldProducts.length === 0) {
        console.error('❌ No old products with images available');
        reject(new Error('No old products with images available'));
        return;
      }
      
      console.log(`\n📊 Data Sources:`);
      console.log(`   - Government products: ${governmentProducts.length}`);
      console.log(`   - Old products with images: ${oldProducts.length}`);
      
      // Combine data
      const combinedProducts = [];
      let matchedCount = 0;
      let noMatchCount = 0;
      
      for (const govProduct of governmentProducts) {
        const matchingImage = findMatchingImageByNameStrict(govProduct.name, oldProducts);
        
        if (matchingImage) {
          // Create combined product with government data + old image
          const combinedProduct = {
            _id: new mongoose.Types.ObjectId(),
            name: govProduct.name,
            barcode: govProduct.barcode,
            img: matchingImage, // Use the old image
            count: 0,
            brand: govProduct.brand,
            manufacturer: govProduct.manufacturer,
            updateDate: govProduct.updateDate,
            source: 'government_with_old_image'
          };
          
          combinedProducts.push(combinedProduct);
          matchedCount++;
          
        } else {
          // Still include the product but with a placeholder image
          const combinedProduct = {
            _id: new mongoose.Types.ObjectId(),
            name: govProduct.name,
            barcode: govProduct.barcode,
            img: 'https://via.placeholder.com/100?text=No+Image', // Placeholder
            count: 0,
            brand: govProduct.brand,
            manufacturer: govProduct.manufacturer,
            updateDate: govProduct.updateDate,
            source: 'government_no_image'
          };
          
          combinedProducts.push(combinedProduct);
          noMatchCount++;
        }
      }
      
      console.log('\n🎉 Data combination completed!');
      console.log(`📈 Total combined products: ${combinedProducts.length}`);
      console.log(`✅ Products with images: ${matchedCount}`);
      console.log(`❌ Products without images: ${noMatchCount}`);
      
      // Save combined data to JSON file
      const outputPath = path.join(__dirname, 'combined_products_with_images.json');
      fs.writeFileSync(outputPath, JSON.stringify(combinedProducts, null, 2));
      
      console.log(`💾 Combined data saved to: ${outputPath}`);
      
      // Show sample of combined products
      console.log('\n📋 Sample combined products:');
      combinedProducts.slice(0, 5).forEach((product, index) => {
        const imageStatus = product.img === 'https://via.placeholder.com/100?text=No+Image' 
          ? '❌ No Image' 
          : product.img.startsWith('data:image') 
            ? '✅ Base64 Image' 
            : '✅ URL Image';
        console.log(`   ${index + 1}. ${product.name} - ${imageStatus}`);
      });
      
      resolve({
        combinedProducts,
        matchedCount,
        noMatchCount,
        outputPath
      });
      
    } catch (error) {
      console.error('❌ Error combining data:', error);
      reject(error);
    }
  });
}

// Function to seed the combined data to MongoDB
async function seedCombinedDataToMongo() {
  try {
    console.log('🚀 Starting MongoDB seeding process...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Combine the data
    const result = await combineGovernmentDataWithImages();
    
    if (!result || result.combinedProducts.length === 0) {
      console.error('❌ No combined data to seed');
      return;
    }
    
    // Clear existing products
    console.log('🗑️  Clearing existing products...');
    await Product.deleteMany({});
    console.log('✅ Existing products cleared');
    
    // Insert combined products
    console.log(`📥 Inserting ${result.combinedProducts.length} combined products...`);
    
    // Insert in batches to avoid memory issues
    const batchSize = 1000;
    let insertedCount = 0;
    
    for (let i = 0; i < result.combinedProducts.length; i += batchSize) {
      const batch = result.combinedProducts.slice(i, i + batchSize);
      await Product.insertMany(batch);
      insertedCount += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${insertedCount}/${result.combinedProducts.length} products`);
    }
    
    // Create indexes for better performance
    console.log('🔍 Creating database indexes...');
    try {
      await Product.collection.createIndex({ name: 'text' });
      await Product.collection.createIndex({ barcode: 1 });
      await Product.collection.createIndex({ brand: 1 });
      console.log('✅ Indexes created');
    } catch (indexError) {
      console.warn('⚠️  Warning: Could not create some indexes:', indexError.message);
    }
    
    // Verify the import
    const totalProducts = await Product.countDocuments();
    const productsWithImages = await Product.countDocuments({
      img: { $ne: 'https://via.placeholder.com/100?text=No+Image' }
    });
    
    console.log('\n📊 Final Database Status:');
    console.log(`   - Total products: ${totalProducts}`);
    console.log(`   - Products with images: ${productsWithImages}`);
    console.log(`   - Products without images: ${totalProducts - productsWithImages}`);
    
    // Show sample of imported products
    const sampleProducts = await Product.find().limit(5);
    console.log('\n📋 Sample imported products:');
    sampleProducts.forEach((product, index) => {
      const imageStatus = product.img === 'https://via.placeholder.com/100?text=No+Image' 
        ? '❌ No Image' 
        : '✅ Has Image';
      console.log(`   ${index + 1}. ${product.name} - ${imageStatus}`);
    });
    
    console.log('\n🎉 Combined data seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding combined data:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Main execution
if (require.main === module) {
  const command = process.argv[2] || 'combine';
  
  switch (command) {
    case 'combine':
      combineGovernmentDataWithImages()
        .then(() => {
          console.log('\n✅ Data combination completed');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Data combination failed:', error);
          process.exit(1);
        });
      break;
      
    case 'seed':
      seedCombinedDataToMongo()
        .then(() => {
          console.log('\n✅ Seeding completed');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Seeding failed:', error);
          process.exit(1);
        });
      break;
      
    default:
      console.log('\n📖 Available Commands:');
      console.log('   node combineGovernmentDataWithImages.js combine  # Combine data only');
      console.log('   node combineGovernmentDataWithImages.js seed     # Combine and seed to MongoDB');
      process.exit(0);
  }
}

module.exports = { 
  combineGovernmentDataWithImages, 
  seedCombinedDataToMongo,
  loadGovernmentData,
  loadOldProductsWithImages
}; 