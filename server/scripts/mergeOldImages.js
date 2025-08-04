// server/scripts/mergeOldImages.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const fs = require('fs');

// Function to load old products data
function loadOldProducts() {
  try {
    console.log('📂 Loading old products data...');
    const oldProductsPath = path.join(__dirname, 'products.json');
    
    if (!fs.existsSync(oldProductsPath)) {
      console.error('❌ Old products.json not found!');
      return [];
    }
    
    const oldProductsData = fs.readFileSync(oldProductsPath, 'utf8');
    const oldProducts = JSON.parse(oldProductsData);
    
    console.log(`✅ Loaded ${oldProducts.length} old products`);
    return oldProducts;
    
  } catch (error) {
    console.error('❌ Error loading old products:', error);
    return [];
  }
}

// Function to find matching image from old data
function findMatchingImage(productName, barcode, oldProducts) {
  try {
    // First try to match by exact barcode
    const barcodeMatch = oldProducts.find(old => 
      old.barcode && old.barcode.toString() === barcode.toString()
    );
    
    if (barcodeMatch && barcodeMatch.img && barcodeMatch.img !== 'null') {
      console.log(`✅ Found barcode match for: ${productName}`);
      return barcodeMatch.img;
    }
    
    // Then try to match by product name (fuzzy matching)
    const normalizedName = productName.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    for (const oldProduct of oldProducts) {
      if (!oldProduct.name || !oldProduct.img || oldProduct.img === 'null') continue;
      
      const oldNormalizedName = oldProduct.name.toLowerCase().replace(/[^\w\s]/g, '').trim();
      
      // Check if names are similar (basic similarity check)
      if (normalizedName.includes(oldNormalizedName) || oldNormalizedName.includes(normalizedName)) {
        console.log(`✅ Found name match for: ${productName} -> ${oldProduct.name}`);
        return oldProduct.img;
      }
    }
    
    console.log(`❌ No match found for: ${productName}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error finding match for ${productName}:`, error);
    return null;
  }
}

// Function to merge old images with new government data
async function mergeOldImages() {
  try {
    console.log('🚀 Starting image merge process...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Load old products data
    const oldProducts = loadOldProducts();
    
    if (oldProducts.length === 0) {
      console.error('❌ No old products data available for merging');
      return;
    }
    
    // Get current government products
    const currentProducts = await Product.find({
      img: 'https://via.placeholder.com/100?text=No+Image'
    });
    
    console.log(`📊 Found ${currentProducts.length} products with placeholder images`);
    
    if (currentProducts.length === 0) {
      console.log('✅ No products need image updates');
      return;
    }
    
    let updatedCount = 0;
    let noMatchCount = 0;
    
    // Process each product
    for (const product of currentProducts) {
      try {
        console.log(`\n📦 Processing: ${product.name} (${product.barcode})`);
        
        const matchingImage = findMatchingImage(product.name, product.barcode, oldProducts);
        
        if (matchingImage) {
          // Update the product with the old image
          await Product.findByIdAndUpdate(product._id, {
            img: matchingImage
          });
          
          updatedCount++;
          console.log(`✅ Updated product: ${product.name}`);
        } else {
          noMatchCount++;
          console.log(`⚠️  No matching image found for: ${product.name}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${product.name}:`, error.message);
      }
    }
    
    console.log('\n🎉 Image merge process completed!');
    console.log(`📈 Total products processed: ${currentProducts.length}`);
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`❌ No match found: ${noMatchCount}`);
    
    // Show sample of updated products
    const sampleUpdated = await Product.find({
      img: { $ne: 'https://via.placeholder.com/100?text=No+Image' }
    }).limit(5);
    
    console.log('\n📋 Sample updated products:');
    sampleUpdated.forEach((product, index) => {
      const imagePreview = product.img.startsWith('data:image') 
        ? 'Base64 Image' 
        : product.img.substring(0, 50) + '...';
      console.log(`   ${index + 1}. ${product.name} - Image: ${imagePreview}`);
    });
    
  } catch (error) {
    console.error('❌ Error merging images:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Function to create a detailed report of the merge process
async function createMergeReport() {
  try {
    console.log('📊 Creating merge report...');
    
    const oldProducts = loadOldProducts();
    const currentProducts = await Product.find({});
    
    const report = {
      timestamp: new Date().toISOString(),
      oldProductsCount: oldProducts.length,
      currentProductsCount: currentProducts.length,
      productsWithImages: currentProducts.filter(p => p.img && p.img !== 'https://via.placeholder.com/100?text=No+Image').length,
      productsWithoutImages: currentProducts.filter(p => !p.img || p.img === 'https://via.placeholder.com/100?text=No+Image').length,
      sampleProducts: currentProducts.slice(0, 10).map(p => ({
        name: p.name,
        barcode: p.barcode,
        hasImage: p.img && p.img !== 'https://via.placeholder.com/100?text=No+Image',
        imageType: p.img ? (p.img.startsWith('data:image') ? 'base64' : 'url') : 'none'
      }))
    };
    
    const reportPath = path.join(__dirname, 'merge_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`✅ Merge report saved to: ${reportPath}`);
    console.log('\n📋 Report Summary:');
    console.log(`   - Old products: ${report.oldProductsCount}`);
    console.log(`   - Current products: ${report.currentProductsCount}`);
    console.log(`   - Products with images: ${report.productsWithImages}`);
    console.log(`   - Products without images: ${report.productsWithoutImages}`);
    
  } catch (error) {
    console.error('❌ Error creating merge report:', error);
  }
}

// Main execution
if (require.main === module) {
  mergeOldImages()
    .then(() => createMergeReport())
    .then(() => {
      console.log('✅ Image merge completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Image merge failed:', error);
      process.exit(1);
    });
}

module.exports = { mergeOldImages, findMatchingImage, createMergeReport }; 