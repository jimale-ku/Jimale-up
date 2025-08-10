const mongoose = require('mongoose');
const Product = require('../models/Product');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// MongoDB connection
const MONGODB_URI = process.env.MONGO_URI || 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// Check current database state
async function checkCurrentDatabase() {
  try {
    console.log('🔍 CHECKING CURRENT DATABASE STATE...');
    console.log('=' .repeat(50));
    
    const totalProducts = await Product.countDocuments();
    console.log(`📊 Total products in database: ${totalProducts}`);
    
    const productsWithImages = await Product.countDocuments({
      img: { $exists: true, $ne: null, $ne: '' }
    });
    console.log(`🖼 Products with images: ${productsWithImages}`);
    
    const productsWithoutImages = totalProducts - productsWithImages;
    console.log(`❌ Products without images: ${productsWithoutImages}`);
    
    // Show sample products
    const sampleProducts = await Product.find().limit(5).lean();
    console.log('\n📋 Sample products in database:');
    if (sampleProducts.length > 0) {
      sampleProducts.forEach((product, index) => {
        console.log(`${index + 1}. ${product.name} (Barcode: ${product.barcode})`);
      });
    } else {
      console.log('No products found in database.');
    }
    
    return { totalProducts, productsWithImages, productsWithoutImages };
    
  } catch (error) {
    console.error('❌ Error checking database state:', error);
    return null;
  }
}

// Load products from products_safe_updated.json
function loadUpdatedProducts() {
  try {
    const productsPath = path.resolve(__dirname, 'products_safe_updated.json');
    const fs = require('fs');
    
    if (!fs.existsSync(productsPath)) {
      console.error('❌ products_safe_updated.json not found!');
      console.log('Please run the barcode replacement script first to create this file.');
      return null;
    }
    
    const data = fs.readFileSync(productsPath, 'utf-8');
    const products = JSON.parse(data);
    console.log(`✅ Loaded ${products.length} products from products_safe_updated.json`);
    return products;
  } catch (error) {
    console.error('❌ Error loading products_safe_updated.json:', error);
    return null;
  }
}

// Populate database with updated data
async function populateWithUpdatedData() {
  try {
    console.log('📥 POPULATING DATABASE WITH UPDATED DATA...');
    console.log('=' .repeat(50));
    
    // Load updated products
    const updatedProducts = loadUpdatedProducts();
    if (!updatedProducts) {
      return null;
    }
    
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
    
    return { totalProducts, productsWithImages };
    
  } catch (error) {
    console.error('❌ Error populating database:', error);
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
  
  // Step 2: Check if products_safe_updated.json exists
  console.log('\n🔄 STEP 2: Checking for updated products file...');
  console.log('=' .repeat(40));
  
  const fs = require('fs');
  const productsPath = path.resolve(__dirname, 'products_safe_updated.json');
  
  if (!fs.existsSync(productsPath)) {
    console.error('❌ products_safe_updated.json not found!');
    console.log('Please run the barcode replacement script first to create this file.');
    console.log('Expected file: ' + productsPath);
    return;
  }
  
  console.log('✅ Found products_safe_updated.json');
  
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
