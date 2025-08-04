// server/scripts/fetchProductImages.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const axios = require('axios');
const fs = require('fs');

// Function to scrape product image from chp.co.il
async function scrapeProductImage(barcode) {
  try {
    console.log(`🔍 Searching for barcode: ${barcode}`);
    
    // Search URL for chp.co.il
    const searchUrl = `https://www.chp.co.il/search?q=${barcode}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000
    });

    const html = response.data;
    
    // Look for product image in the HTML
    // This is a basic pattern - you might need to adjust based on chp.co.il's actual HTML structure
    const imageMatch = html.match(/<img[^>]+src=["']([^"']*\.(?:jpg|jpeg|png|gif))["'][^>]*>/i);
    
    if (imageMatch && imageMatch[1]) {
      let imageUrl = imageMatch[1];
      
      // Handle relative URLs
      if (imageUrl.startsWith('/')) {
        imageUrl = `https://www.chp.co.il${imageUrl}`;
      } else if (imageUrl.startsWith('./')) {
        imageUrl = `https://www.chp.co.il${imageUrl.substring(1)}`;
      }
      
      console.log(`✅ Found image for barcode ${barcode}: ${imageUrl}`);
      return imageUrl;
    }
    
    console.log(`❌ No image found for barcode ${barcode}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Error scraping image for barcode ${barcode}:`, error.message);
    return null;
  }
}

// Function to update products with real images
async function updateProductsWithImages() {
  try {
    console.log('🚀 Starting image update process...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get all products with placeholder images
    const products = await Product.find({
      img: 'https://via.placeholder.com/100?text=No+Image'
    });
    
    console.log(`📊 Found ${products.length} products with placeholder images`);
    
    if (products.length === 0) {
      console.log('✅ No products need image updates');
      return;
    }
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Process products in batches to avoid overwhelming the server
    const batchSize = 10;
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)}`);
      
      // Process batch with delays to be respectful to the server
      for (const product of batch) {
        try {
          console.log(`\n📦 Processing: ${product.name} (${product.barcode})`);
          
          const imageUrl = await scrapeProductImage(product.barcode);
          
          if (imageUrl) {
            // Update the product with the real image URL
            await Product.findByIdAndUpdate(product._id, {
              img: imageUrl
            });
            
            updatedCount++;
            console.log(`✅ Updated product: ${product.name}`);
          } else {
            errorCount++;
            console.log(`⚠️  Could not find image for: ${product.name}`);
          }
          
          // Add a small delay between requests to be respectful
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing ${product.name}:`, error.message);
        }
      }
      
      // Add delay between batches
      if (i + batchSize < products.length) {
        console.log('⏳ Waiting 5 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log('\n🎉 Image update process completed!');
    console.log(`📈 Total products processed: ${products.length}`);
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`❌ Failed to update: ${errorCount}`);
    
    // Show sample of updated products
    const sampleUpdated = await Product.find({
      img: { $ne: 'https://via.placeholder.com/100?text=No+Image' }
    }).limit(5);
    
    console.log('\n📋 Sample updated products:');
    sampleUpdated.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} - Image: ${product.img.substring(0, 50)}...`);
    });
    
  } catch (error) {
    console.error('❌ Error updating products with images:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Function to create a backup of current products
async function backupCurrentProducts() {
  try {
    console.log('💾 Creating backup of current products...');
    
    const products = await Product.find({});
    const backupPath = path.join(__dirname, 'products_backup.json');
    
    fs.writeFileSync(backupPath, JSON.stringify(products, null, 2));
    console.log(`✅ Backup saved to: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ Error creating backup:', error);
  }
}

// Main execution
if (require.main === module) {
  updateProductsWithImages()
    .then(() => {
      console.log('✅ Image update completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Image update failed:', error);
      process.exit(1);
    });
}

module.exports = { updateProductsWithImages, scrapeProductImage, backupCurrentProducts }; 