// server/scripts/fixBarcodes.js
const mongoose = require('mongoose');
require('dotenv').config();

async function connectToDatabase() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function fixBarcodes() {
  try {
    await connectToDatabase();
    
    const Product = require('../models/Product');
    
    console.log('🔧 FIXING BARCODE ISSUES\n');
    
    // Find products with short barcodes (< 8 chars)
    const shortBarcodeProducts = await Product.find({
      barcode: { $exists: true, $ne: null, $ne: '' },
      $expr: { $lt: [{ $strLenCP: '$barcode' }, 8] }
    });
    
    console.log(`📊 Found ${shortBarcodeProducts.length} products with short barcodes`);
    
    if (shortBarcodeProducts.length === 0) {
      console.log('✅ No short barcodes found - database is clean!');
      await mongoose.disconnect();
      return;
    }
    
    // Show sample of what will be fixed
    console.log('\n📋 Sample products to be fixed:');
    shortBarcodeProducts.slice(0, 5).forEach((product, i) => {
      console.log(`   ${i + 1}. "${product.name}" (Barcode: "${product.barcode}")`);
    });
    
    // Ask for confirmation
    console.log('\n⚠️  This will clear short barcodes and rely on name-based scraping.');
    console.log('   This should improve scraping success rate.');
    
    // Fix the barcodes by clearing short ones
    const updateResult = await Product.updateMany(
      {
        barcode: { $exists: true, $ne: null, $ne: '' },
        $expr: { $lt: [{ $strLenCP: '$barcode' }, 8] }
      },
      {
        $set: { barcode: '' } // Clear short barcodes
      }
    );
    
    console.log(`\n✅ Fixed ${updateResult.modifiedCount} products`);
    console.log('   Short barcodes cleared - will now use name-based scraping');
    
    // Verify the fix
    const remainingShortBarcodes = await Product.countDocuments({
      barcode: { $exists: true, $ne: null, $ne: '' },
      $expr: { $lt: [{ $strLenCP: '$barcode' }, 8] }
    });
    
    console.log(`\n📊 Verification: ${remainingShortBarcodes} products still have short barcodes`);
    
    if (remainingShortBarcodes === 0) {
      console.log('✅ All short barcodes have been cleared!');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Barcode fix completed');
    
  } catch (error) {
    console.error('❌ Error fixing barcodes:', error);
    await mongoose.disconnect();
  }
}

fixBarcodes();



