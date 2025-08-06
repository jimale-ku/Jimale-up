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

// Load updated products data
function loadUpdatedProducts() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'products_safe_updated.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading updated products:', error);
    return [];
  }
}

// Clear existing products and populate with new data
async function populateDatabase() {
  try {
    await connectToDatabase();
    
    const Product = require('../models/Product');
    const updatedProducts = loadUpdatedProducts();
    
    if (updatedProducts.length === 0) {
      console.error('❌ No updated products found. Please run safeBarcodeReplacement.js first.');
      return;
    }
    
    console.log(`📊 Found ${updatedProducts.length} updated products to populate`);
    
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
      source: product.source || 'updated_barcode_replacement'
    }));
    
    // Insert new products
    console.log('📥 Inserting updated products...');
    const result = await Product.insertMany(productsToInsert);
    console.log(`✅ Successfully inserted ${result.length} products`);
    
    // Verify the insertion
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in database after update: ${totalProducts}`);
    
    // Check products with images
    const productsWithImages = await Product.countDocuments({
      img: { $exists: true, $ne: null, $ne: '' }
    });
    console.log(`🖼️  Products with images: ${productsWithImages}`);
    
    // Show sample of updated products
    const sampleProducts = await Product.find().limit(5).lean();
    console.log('\n📋 Sample updated products:');
    sampleProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (Barcode: ${product.barcode})`);
    });
    
    await mongoose.disconnect();
    console.log('\n🎉 Database population completed successfully!');
    
  } catch (error) {
    console.error('❌ Error populating database:', error);
    await mongoose.disconnect();
  }
}

// Run the population
populateDatabase(); 