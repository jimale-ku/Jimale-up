// server/scripts/seedGovernmentProducts.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const { convertGovernmentExcel, validateBarcodes } = require('./convertGovernmentData');

async function seedGovernmentProducts() {
  try {
    console.log('🚀 Starting government products seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Convert Excel to JSON if not already done
    console.log('🔄 Converting Excel data...');
    const products = convertGovernmentExcel();
    
    if (!products || products.length === 0) {
      console.error('❌ No products found to import');
      return;
    }
    
    // Validate barcodes
    const validation = validateBarcodes(products);
    const validProducts = validation.validBarcodes;
    
    if (validProducts.length === 0) {
      console.error('❌ No valid products found after validation');
      return;
    }
    
    // Clear existing products
    console.log('🗑️  Clearing existing products...');
    await Product.deleteMany({});
    console.log('✅ Existing products cleared');
    
    // Insert new government products
    console.log(`📥 Inserting ${validProducts.length} government products...`);
    
    // Insert in batches to avoid memory issues
    const batchSize = 1000;
    let insertedCount = 0;
    
    for (let i = 0; i < validProducts.length; i += batchSize) {
      const batch = validProducts.slice(i, i + batchSize);
      await Product.insertMany(batch);
      insertedCount += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${insertedCount}/${validProducts.length} products`);
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
    console.log(`📊 Total products in database: ${totalProducts}`);
    
    // Show sample of imported products
    const sampleProducts = await Product.find().limit(5);
    console.log('\n📋 Sample imported products:');
    sampleProducts.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} (Barcode: ${product.barcode})`);
    });
    
    console.log('\n🎉 Government products seeding completed successfully!');
    console.log(`📈 Total products imported: ${insertedCount}`);
    console.log(`❌ Skipped invalid barcodes: ${validation.invalidBarcodes.length}`);
    
  } catch (error) {
    console.error('❌ Error seeding government products:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the seeding if this script is executed directly
if (require.main === module) {
  seedGovernmentProducts()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedGovernmentProducts; 