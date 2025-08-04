// server/scripts/solveImageIssue.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../models/Product');
const fs = require('fs');

// Import the other scripts
const { updateProductsWithImages, backupCurrentProducts } = require('./fetchProductImages');
const { mergeOldImages, createMergeReport } = require('./mergeOldImages');

// Function to analyze current situation
async function analyzeCurrentSituation() {
  try {
    console.log('🔍 Analyzing current situation...');
    
    await mongoose.connect(process.env.MONGO_URI);
    
    const totalProducts = await Product.countDocuments();
    const productsWithPlaceholder = await Product.countDocuments({
      img: 'https://via.placeholder.com/100?text=No+Image'
    });
    const productsWithRealImages = await Product.countDocuments({
      img: { $ne: 'https://via.placeholder.com/100?text=No+Image' }
    });
    
    console.log('\n📊 Current Database Status:');
    console.log(`   - Total products: ${totalProducts}`);
    console.log(`   - Products with placeholder images: ${productsWithPlaceholder}`);
    console.log(`   - Products with real images: ${productsWithRealImages}`);
    
    // Check if old products.json exists
    const oldProductsPath = path.join(__dirname, 'products.json');
    const hasOldProducts = fs.existsSync(oldProductsPath);
    
    console.log(`\n📂 File Status:`);
    console.log(`   - Old products.json exists: ${hasOldProducts ? '✅ Yes' : '❌ No'}`);
    
    if (hasOldProducts) {
      const oldProductsData = fs.readFileSync(oldProductsPath, 'utf8');
      const oldProducts = JSON.parse(oldProductsData);
      const oldProductsWithImages = oldProducts.filter(p => p.img && p.img !== 'null').length;
      
      console.log(`   - Old products with images: ${oldProductsWithImages}/${oldProducts.length}`);
    }
    
    // Show sample of current products
    const sampleProducts = await Product.find().limit(5);
    console.log('\n📋 Sample Current Products:');
    sampleProducts.forEach((product, index) => {
      const imageStatus = product.img === 'https://via.placeholder.com/100?text=No+Image' 
        ? '❌ Placeholder' 
        : product.img.startsWith('data:image') 
          ? '✅ Base64 Image' 
          : '✅ URL Image';
      console.log(`   ${index + 1}. ${product.name} - ${imageStatus}`);
    });
    
    await mongoose.disconnect();
    
    return {
      totalProducts,
      productsWithPlaceholder,
      productsWithRealImages,
      hasOldProducts
    };
    
  } catch (error) {
    console.error('❌ Error analyzing situation:', error);
    throw error;
  }
}

// Function to provide solution recommendations
function provideRecommendations(analysis) {
  console.log('\n💡 Solution Recommendations:');
  
  if (analysis.hasOldProducts) {
    console.log('\n1️⃣  RECOMMENDED: Merge with old images');
    console.log('   - Use existing images from products.json');
    console.log('   - Fastest and most reliable option');
    console.log('   - Command: node mergeOldImages.js');
    
    console.log('\n2️⃣  ALTERNATIVE: Scrape new images');
    console.log('   - Fetch images from chp.co.il using new barcodes');
    console.log('   - May take longer and have rate limiting');
    console.log('   - Command: node fetchProductImages.js');
  } else {
    console.log('\n1️⃣  RECOMMENDED: Scrape new images');
    console.log('   - Fetch images from chp.co.il using new barcodes');
    console.log('   - Only option available without old data');
    console.log('   - Command: node fetchProductImages.js');
  }
  
  console.log('\n3️⃣  HYBRID APPROACH:');
  console.log('   - First try merging with old images');
  console.log('   - Then scrape remaining missing images');
  console.log('   - Commands: node mergeOldImages.js && node fetchProductImages.js');
}

// Function to execute the recommended solution
async function executeRecommendedSolution() {
  try {
    console.log('🚀 Executing recommended solution...');
    
    const analysis = await analyzeCurrentSituation();
    
    if (analysis.hasOldProducts) {
      console.log('\n🔄 Step 1: Merging with old images...');
      await mergeOldImages();
      
      console.log('\n🔄 Step 2: Creating backup...');
      await backupCurrentProducts();
      
      console.log('\n🔄 Step 3: Scraping remaining missing images...');
      await updateProductsWithImages();
      
    } else {
      console.log('\n🔄 Step 1: Creating backup...');
      await backupCurrentProducts();
      
      console.log('\n🔄 Step 2: Scraping images from chp.co.il...');
      await updateProductsWithImages();
    }
    
    console.log('\n✅ Recommended solution completed!');
    
  } catch (error) {
    console.error('❌ Error executing recommended solution:', error);
    throw error;
  }
}

// Function to show detailed help
function showHelp() {
  console.log('\n📖 Available Commands:');
  console.log('\n🔍 Analyze current situation:');
  console.log('   node solveImageIssue.js analyze');
  
  console.log('\n💡 Get recommendations:');
  console.log('   node solveImageIssue.js recommend');
  
  console.log('\n🚀 Execute recommended solution:');
  console.log('   node solveImageIssue.js execute');
  
  console.log('\n🔄 Merge with old images:');
  console.log('   node solveImageIssue.js merge');
  
  console.log('\n🌐 Scrape new images:');
  console.log('   node solveImageIssue.js scrape');
  
  console.log('\n📊 Create detailed report:');
  console.log('   node solveImageIssue.js report');
  
  console.log('\n💾 Create backup:');
  console.log('   node solveImageIssue.js backup');
}

// Main execution
if (require.main === module) {
  const command = process.argv[2] || 'help';
  
  switch (command) {
    case 'analyze':
      analyzeCurrentSituation()
        .then(() => {
          console.log('\n✅ Analysis completed');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Analysis failed:', error);
          process.exit(1);
        });
      break;
      
    case 'recommend':
      analyzeCurrentSituation()
        .then(provideRecommendations)
        .then(() => {
          console.log('\n✅ Recommendations provided');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Failed to provide recommendations:', error);
          process.exit(1);
        });
      break;
      
    case 'execute':
      executeRecommendedSolution()
        .then(() => {
          console.log('\n✅ Solution executed successfully');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Solution execution failed:', error);
          process.exit(1);
        });
      break;
      
    case 'merge':
      mergeOldImages()
        .then(() => {
          console.log('\n✅ Image merge completed');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Image merge failed:', error);
          process.exit(1);
        });
      break;
      
    case 'scrape':
      updateProductsWithImages()
        .then(() => {
          console.log('\n✅ Image scraping completed');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Image scraping failed:', error);
          process.exit(1);
        });
      break;
      
    case 'report':
      createMergeReport()
        .then(() => {
          console.log('\n✅ Report created');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Report creation failed:', error);
          process.exit(1);
        });
      break;
      
    case 'backup':
      backupCurrentProducts()
        .then(() => {
          console.log('\n✅ Backup created');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Backup failed:', error);
          process.exit(1);
        });
      break;
      
    default:
      showHelp();
      process.exit(0);
  }
}

module.exports = { 
  analyzeCurrentSituation, 
  provideRecommendations, 
  executeRecommendedSolution,
  showHelp
}; 