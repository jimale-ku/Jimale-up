const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import Product model
const Product = require('../models/Product');

// MongoDB connection
const MONGODB_URI = process.env.MONGO_URI || 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';

async function seedProductsToMongo() {
  try {
    console.log('🚀 Starting product seeding to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Read products.json file
    const productsPath = path.resolve(__dirname, 'products.json');
    console.log(`📁 Reading products from: ${productsPath}`);
    
    if (!fs.existsSync(productsPath)) {
      throw new Error('products.json file not found!');
    }
    
    const data = fs.readFileSync(productsPath, 'utf-8');
    const products = JSON.parse(data);
    console.log(`📊 Found ${products.length} products in JSON file`);
    
    // Clear existing products
    console.log('🧹 Clearing existing products...');
    await Product.deleteMany({});
    console.log('✅ Existing products cleared');
    
    // Transform products for MongoDB
    console.log('🔄 Transforming products for MongoDB...');
    const transformedProducts = products.map((product, index) => ({
      _id: product._id || new mongoose.Types.ObjectId(),
      name: product.name || `Product ${index + 1}`,
      barcode: product.barcode || Math.floor(Math.random() * 1000000),
      img: product.img || 'https://via.placeholder.com/300x300?text=Product',
      category: product.category || 'General',
      price: product.price || (Math.random() * 50 + 5).toFixed(2),
      description: product.description || 'A great product for your needs',
      brand: product.brand || 'SmartBuy',
      rating: product.rating || (Math.random() * 2 + 3).toFixed(1),
      reviews: product.reviews || Math.floor(Math.random() * 100),
      inStock: product.inStock !== undefined ? product.inStock : Math.random() > 0.2,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    console.log(`✅ Transformed ${transformedProducts.length} products`);
    
    // Insert products in batches
    const batchSize = 1000;
    let insertedCount = 0;
    
    console.log(`📦 Inserting products in batches of ${batchSize}...`);
    
    for (let i = 0; i < transformedProducts.length; i += batchSize) {
      const batch = transformedProducts.slice(i, i + batchSize);
      await Product.insertMany(batch);
      insertedCount += batch.length;
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${insertedCount}/${transformedProducts.length} products`);
    }
    
    console.log('🎉 Product seeding completed successfully!');
    console.log(`📊 Total products in MongoDB: ${await Product.countDocuments()}`);
    
    // Create indexes for better performance
    console.log('🔍 Creating database indexes...');
    try {
      await Product.collection.createIndex({ name: 'text' });
      await Product.collection.createIndex({ category: 1 });
      await Product.collection.createIndex({ price: 1 });
      await Product.collection.createIndex({ rating: -1 });
      console.log('✅ Indexes created');
    } catch (indexError) {
      console.log('⚠️ Index creation failed (this is okay):', indexError.message);
    }
    
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    throw error;
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the seeding function
if (require.main === module) {
  seedProductsToMongo()
    .then(() => {
      console.log('🎯 Product seeding script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Product seeding failed:', error);
      process.exit(1);
    });
}

module.exports = seedProductsToMongo; 