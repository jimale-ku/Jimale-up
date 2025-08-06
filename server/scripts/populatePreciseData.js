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

// Populate database with precise updated data
async function populatePreciseData() {
  try {
    await connectToDatabase();
    
    const Product = require('../models/Product');
    
    // Check if precise updated file exists
    const updatedFilePath = path.join(__dirname, 'products_precise_updated.json');
    if (!fs.existsSync(updatedFilePath)) {
      console.error('❌ Precise updated products file not found. Please run preciseBarcodeUpdate.js first.');
      return;
    }
    
    const updatedProducts = JSON.parse(fs.readFileSync(updatedFilePath, 'utf8'));
    console.log(`📊 Found ${updatedProducts.length} precise updated products to populate`);
    
    // Check current database state
    const currentCount = await Product.countDocuments();
    console.log(`📊 Current products in database: ${currentCount}`);
    
    // Clear existing products
    console.log('🗑️  Clearing existing products...');
    const deletedCount = await Product.deleteMany({});
    console.log(`✅ Deleted ${deletedCount.deletedCount} existing products`);
    
    // Prepare products for insertion
    const productsToInsert = updatedProducts.map(product => ({
      name: product.name,
      barcode: product.barcode,
      img: product.img,
      count: product.count || 0,
      brand: product.brand || '',
      manufacturer: product.manufacturer || '',
      updateDate: product.updateDate || new Date(),
      source: product.source || 'precise_barcode_update'
    }));
    
    // Insert new products
    console.log('📥 Inserting precise updated products...');
    const insertedProducts = await Product.insertMany(productsToInsert);
    console.log(`✅ Successfully inserted ${insertedProducts.length} products`);
    
    // Verify the insertion
    const finalCount = await Product.countDocuments();
    console.log(`📊 Final products in database: ${finalCount}`);
    
    // Show sample of updated products
    const sampleProducts = await Product.find().limit(5).select('name barcode').lean();
    console.log('\n📋 Sample products in database:');
    sampleProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (Barcode: ${product.barcode})`);
    });
    
    console.log('\n🎉 Database populated with precise updated data!');
    console.log('\n🔍 Next steps:');
    console.log('   1. Run integrity tests to verify data quality');
    console.log('   2. Test barcode scanning in your app');
    console.log('   3. Verify that no duplicate barcodes exist');
    
  } catch (error) {
    console.error('❌ Error populating database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

// Run if this file is executed directly
if (require.main === module) {
  populatePreciseData();
}

module.exports = {
  populatePreciseData
}; 