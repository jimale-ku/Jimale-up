const fs = require('fs');
const path = require('path');

console.log('🚀 SMART BUY - MILESTONE 3 SETUP');
console.log('================================');
console.log('');

// Check if products.json exists
const productsPath = path.join(__dirname, 'products.json');
if (!fs.existsSync(productsPath)) {
  console.log('❌ ERROR: products.json not found!');
  console.log('   Please make sure products.json is in the scripts folder.');
  process.exit(1);
}

// Check if seeding script exists
const seedingScriptPath = path.join(__dirname, 'seedMilestone3Data.js');
if (!fs.existsSync(seedingScriptPath)) {
  console.log('❌ ERROR: seedMilestone3Data.js not found!');
  console.log('   Please make sure the seeding script is in the scripts folder.');
  process.exit(1);
}

console.log('✅ All required files found!');
console.log('');

console.log('📋 SETUP INSTRUCTIONS:');
console.log('======================');
console.log('');
console.log('1. 📝 EDIT CONNECTION STRING:');
console.log('   Open: server/scripts/seedMilestone3Data.js');
console.log('   Find line with MONGODB_URI and replace with your Atlas connection string');
console.log('   Example: mongodb+srv://username:password@cluster.mongodb.net/smartbuy');
console.log('');
console.log('2. 🚀 RUN THE SEEDING:');
console.log('   From the server folder, run:');
console.log('   node scripts/seedMilestone3Data.js');
console.log('');
console.log('3. ⏱️  WAIT FOR COMPLETION:');
console.log('   The script will take a few minutes to seed all data');
console.log('   You\'ll see progress updates as it runs');
console.log('');
console.log('4. 🎯 TEST THE SYSTEM:');
console.log('   Once complete, your smart suggestions will work with:');
console.log('   • FREQUENT - Based on household purchase patterns');
console.log('   • RECENT - Based on recent shopping history');
console.log('   • FAVORITE - Based on frequently bought items');
console.log('   • ALL - All available products');
console.log('');
console.log('📊 WHAT WILL BE CREATED:');
console.log('========================');
console.log('• 200 products from your products.json');
console.log('• 100+ households with realistic member data');
console.log('• 50+ shopping trips per household');
console.log('• 50,000+ purchase records with seasonal patterns');
console.log('• Groups for each household');
console.log('');
console.log('🎯 MILESTONE 3 FEATURES ENABLED:');
console.log('================================');
console.log('✅ Household past shopping data analysis');
console.log('✅ Global purchase trends across households');
console.log('✅ Seasonal shopping patterns');
console.log('✅ Product association learning');
console.log('✅ Smart prediction accuracy testing');
console.log('');
console.log('💡 FOR YOUR CLIENT:');
console.log('==================');
console.log('• Share your code repository');
console.log('• Client sets their own Atlas connection string');
console.log('• Client runs the same seeding script');
console.log('• Both can test independently with full data');
console.log('');
console.log('Ready to proceed? Edit the connection string and run the seeding script! 🚀'); 