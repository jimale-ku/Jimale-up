const { safeBarcodeReplacement } = require('./safeBarcodeReplacement');
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

// Check current database state
async function checkCurrentDatabase() {
  try {
    await connectToDatabase();
    
    const Product = require('../models/Product');
    
    console.log('\n🔍 CHECKING CURRENT DATABASE STATE...');
    console.log('=' .repeat(50));
    
    // Get total count
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in database: ${totalProducts}`);
    
    // Check products with images
    const productsWithImages = await Product.countDocuments({
      img: { $exists: true, $ne: null, $ne: '' }
    });
    console.log(`🖼️  Products with images: ${productsWithImages}`);
    
    // Check products without images
    const productsWithoutImages = await Product.countDocuments({
      $or: [
        { img: { $exists: false } },
        { img: null },
        { img: '' }
      ]
    });
    console.log(`❌ Products without images: ${productsWithoutImages}`);
    
    // Show sample products
    const sampleProducts = await Product.find().limit(5).lean();
    console.log('\n📋 Sample products in database:');
    sampleProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (Barcode: ${product.barcode})`);
    });
    
    await mongoose.disconnect();
    return { totalProducts, productsWithImages, productsWithoutImages };
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
    await mongoose.disconnect();
    return null;
  }
}

// Load and populate updated data
async function populateWithUpdatedData() {
  try {
    await connectToDatabase();
    
    const Product = require('../models/Product');
    
    // Check if updated file exists
    const updatedFilePath = path.join(__dirname, 'products_safe_updated.json');
    if (!fs.existsSync(updatedFilePath)) {
      console.error('❌ Updated products file not found. Please run barcode replacement first.');
      return;
    }
    
    const updatedProducts = JSON.parse(fs.readFileSync(updatedFilePath, 'utf8'));
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
    return { totalProducts, productsWithImages };
    
  } catch (error) {
    console.error('❌ Error populating database:', error);
    await mongoose.disconnect();
    return null;
  }
}

// Complete workflow
async function runCompleteWorkflow() {
  console.log('🚀 STARTING COMPLETE UPDATE WORKFLOW');
  console.log('=' .repeat(60));
  
  // Step 1: Check current database
  console.log('\n📋 STEP 1: Checking current database state...');
  const beforeState = await checkCurrentDatabase();
  
  if (!beforeState) {
    console.error('❌ Failed to check database state. Exiting.');
    return;
  }
  
  // Step 2: Run barcode replacement
  console.log('\n🔄 STEP 2: Running barcode replacement...');
  console.log('=' .repeat(40));
  
  try {
    const replacementResults = safeBarcodeReplacement();
    console.log('✅ Barcode replacement completed');
  } catch (error) {
    console.error('❌ Barcode replacement failed:', error);
    return;
  }
  
  // Step 3: Populate database with updated data
  console.log('\n📥 STEP 3: Populating database with updated data...');
  console.log('=' .repeat(50));
  
  const afterState = await populateWithUpdatedData();
  
  if (!afterState) {
    console.error('❌ Failed to populate database. Exiting.');
    return;
  }
  
  // Step 4: Summary
  console.log('\n🎉 WORKFLOW COMPLETED SUCCESSFULLY!');
  console.log('=' .repeat(50));
  console.log('📊 SUMMARY:');
  console.log(`   Before: ${beforeState.totalProducts} products (${beforeState.productsWithImages} with images)`);
  console.log(`   After:  ${afterState.totalProducts} products (${afterState.productsWithImages} with images)`);
  console.log(`   Improvement: ${afterState.productsWithImages - beforeState.productsWithImages} more products with images`);
  
  console.log('\n✅ Your database has been updated with current barcodes and preserved images!');
}

// Run the complete workflow
runCompleteWorkflow(); 