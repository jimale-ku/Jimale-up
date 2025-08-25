// Investigate CHP website structure to find correct scraping approach
const axios = require('axios');
const cheerio = require('cheerio');

async function investigateCHPWebsite() {
  console.log('🔍 Investigating CHP Website Structure');
  console.log('─'.repeat(50));
  
  try {
    // Step 1: Get the main CHP page to understand the structure
    console.log('📡 Step 1: Getting main CHP page...');
    const mainResponse = await axios.get('https://chp.co.il/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive'
      },
      timeout: 15000
    });
    
    console.log(`✅ Main page loaded: ${mainResponse.status} status, ${mainResponse.data.length} chars`);
    
    // Parse the main page to find search forms and endpoints
    const $ = cheerio.load(mainResponse.data);
    
    // Look for search forms
    const searchForms = $('form');
    console.log(`📋 Found ${searchForms.length} forms on the page`);
    
    searchForms.each((i, form) => {
      const $form = $(form);
      const action = $form.attr('action');
      const method = $form.attr('method');
      const inputs = $form.find('input');
      
      console.log(`\n📝 Form ${i + 1}:`);
      console.log(`   Action: ${action}`);
      console.log(`   Method: ${method}`);
      console.log(`   Inputs: ${inputs.length}`);
      
      inputs.each((j, input) => {
        const $input = $(input);
        const name = $input.attr('name');
        const type = $input.attr('type');
        const value = $input.attr('value');
        console.log(`     Input ${j + 1}: name="${name}", type="${type}", value="${value}"`);
      });
    });
    
    // Look for search-related links
    const searchLinks = $('a[href*="search"], a[href*="compare"], a[href*="price"]');
    console.log(`\n🔗 Found ${searchLinks.length} search-related links:`);
    
    searchLinks.each((i, link) => {
      const $link = $(link);
      const href = $link.attr('href');
      const text = $link.text().trim();
      console.log(`   ${i + 1}. "${text}" -> ${href}`);
    });
    
    // Look for any JavaScript that might handle search
    const scripts = $('script');
    console.log(`\n📜 Found ${scripts.length} scripts`);
    
    let searchScripts = 0;
    scripts.each((i, script) => {
      const scriptContent = $(script).html();
      if (scriptContent && (scriptContent.includes('search') || scriptContent.includes('compare') || scriptContent.includes('price'))) {
        searchScripts++;
        console.log(`   Script ${i + 1} contains search-related code`);
        // Extract URLs from script
        const urlMatches = scriptContent.match(/['"`]([^'"`]*\/[^'"`]*search[^'"`]*)['"`]/g);
        if (urlMatches) {
          console.log(`     URLs found: ${urlMatches.join(', ')}`);
        }
      }
    });
    
    console.log(`   Total search-related scripts: ${searchScripts}`);
    
  } catch (error) {
    console.error('❌ Error investigating main page:', error.message);
  }
}

async function testDifferentEndpoints() {
  console.log('\n🔍 Testing Different CHP Endpoints');
  console.log('─'.repeat(50));
  
  const testProduct = 'דבש לחיץ 200';
  const testCity = 'רמת גן';
  
  // Test different possible endpoints
  const endpoints = [
    'https://chp.co.il/search',
    'https://chp.co.il/compare',
    'https://chp.co.il/prices',
    'https://chp.co.il/main_page/search',
    'https://chp.co.il/main_page/compare',
    'https://chp.co.il/api/search',
    'https://chp.co.il/api/compare'
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n📡 Testing endpoint: ${endpoint}`);
      
      const response = await axios.get(endpoint, {
        params: {
          q: testProduct,
          city: testCity
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
          'Connection': 'keep-alive'
        },
        timeout: 10000
      });
      
      console.log(`   Status: ${response.status}, Length: ${response.data.length}`);
      
      if (response.data.includes('results') || response.data.includes('price') || response.data.includes('store')) {
        console.log(`   ✅ Found potential results page!`);
        console.log(`   Preview: ${response.data.substring(0, 200)}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
}

async function testPOSTRequest() {
  console.log('\n🔍 Testing POST Request to CHP');
  console.log('─'.repeat(50));
  
  const testProduct = 'דבש לחיץ 200';
  const testCity = 'רמת גן';
  
  try {
    // Try POST request to the compare_results endpoint
    console.log('📡 Testing POST to compare_results...');
    
    const response = await axios.post('https://chp.co.il/main_page/compare_results', {
      shopping_address: testCity,
      shopping_address_street_id: 9000,
      shopping_address_city_id: 0,
      product_barcode: testProduct,
      from: 0,
      num_results: 30
    }, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Connection': 'keep-alive',
        'Referer': 'https://chp.co.il/'
      },
      timeout: 15000
    });
    
    console.log(`✅ POST response: ${response.status} status, ${response.data.length} chars`);
    
    if (response.data.includes('המוצר שחיפשתם לא נמצא')) {
      console.log('❌ Still getting "Product not found"');
    } else {
      console.log('✅ POST request might work!');
      console.log(`Preview: ${response.data.substring(0, 300)}`);
    }
    
  } catch (error) {
    console.error('❌ POST request failed:', error.message);
  }
}

// Run investigation
async function runInvestigation() {
  console.log('🚀 Investigating CHP Website Structure...\n');
  
  await investigateCHPWebsite();
  await testDifferentEndpoints();
  await testPOSTRequest();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 INVESTIGATION SUMMARY');
  console.log('='.repeat(60));
  console.log('This will help us understand the correct way to scrape CHP.');
}

runInvestigation().catch(console.error);
