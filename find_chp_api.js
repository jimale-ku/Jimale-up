// Find CHP's new API endpoints
const axios = require('axios');
const cheerio = require('cheerio');

async function findCHPAPI() {
  console.log('🔍 Finding CHP New API Endpoints');
  console.log('─'.repeat(50));
  
  try {
    // Get the main page and extract JavaScript
    console.log('📡 Getting CHP main page...');
    const response = await axios.get('https://chp.co.il/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract all JavaScript content
    const scripts = $('script');
    console.log(`📜 Found ${scripts.length} scripts`);
    
    // Look for API endpoints in JavaScript
    const apiEndpoints = new Set();
    
    scripts.each((i, script) => {
      const scriptContent = $(script).html();
      if (scriptContent) {
        // Look for API URLs
        const apiMatches = scriptContent.match(/['"`]([^'"`]*\/api\/[^'"`]*)['"`]/g);
        if (apiMatches) {
          apiMatches.forEach(match => {
            const endpoint = match.replace(/['"`]/g, '');
            if (endpoint.includes('api')) {
              apiEndpoints.add(endpoint);
            }
          });
        }
        
        // Look for fetch/axios calls
        const fetchMatches = scriptContent.match(/fetch\(['"`]([^'"`]*)['"`]/g);
        if (fetchMatches) {
          fetchMatches.forEach(match => {
            const url = match.replace(/fetch\(['"`]/, '').replace(/['"`]\)/, '');
            if (url.includes('/') && !url.startsWith('http')) {
              apiEndpoints.add(url);
            }
          });
        }
        
        // Look for AJAX calls
        const ajaxMatches = scriptContent.match(/url:\s*['"`]([^'"`]*)['"`]/g);
        if (ajaxMatches) {
          ajaxMatches.forEach(match => {
            const url = match.replace(/url:\s*['"`]/, '').replace(/['"`]/, '');
            if (url.includes('/') && !url.startsWith('http')) {
              apiEndpoints.add(url);
            }
          });
        }
      }
    });
    
    console.log('\n🔗 Found potential API endpoints:');
    apiEndpoints.forEach(endpoint => {
      console.log(`   • ${endpoint}`);
    });
    
    // Test the found endpoints
    if (apiEndpoints.size > 0) {
      console.log('\n🧪 Testing found endpoints...');
      
      for (const endpoint of apiEndpoints) {
        try {
          const fullUrl = endpoint.startsWith('http') ? endpoint : `https://chp.co.il${endpoint}`;
          console.log(`\n📡 Testing: ${fullUrl}`);
          
          const apiResponse = await axios.get(fullUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
              'Connection': 'keep-alive'
            },
            timeout: 10000
          });
          
          console.log(`   Status: ${apiResponse.status}, Length: ${apiResponse.data.length}`);
          
          if (typeof apiResponse.data === 'object') {
            console.log(`   ✅ JSON response: ${JSON.stringify(apiResponse.data).substring(0, 200)}`);
          } else if (apiResponse.data.includes('results') || apiResponse.data.includes('price')) {
            console.log(`   ✅ Potential API response: ${apiResponse.data.substring(0, 200)}`);
          }
          
        } catch (error) {
          console.log(`   ❌ Failed: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testModernEndpoints() {
  console.log('\n🔍 Testing Modern API Endpoints');
  console.log('─'.repeat(50));
  
  // Common modern API patterns
  const modernEndpoints = [
    '/api/v1/search',
    '/api/v1/products',
    '/api/v1/compare',
    '/api/search',
    '/api/products',
    '/api/compare',
    '/api/price-comparison',
    '/api/product-search',
    '/rest/search',
    '/rest/products',
    '/graphql'
  ];
  
  const testProduct = 'דבש לחיץ 200';
  const testCity = 'רמת גן';
  
  for (const endpoint of modernEndpoints) {
    try {
      console.log(`\n📡 Testing: ${endpoint}`);
      
      // Try GET with query parameters
      const response = await axios.get(`https://chp.co.il${endpoint}`, {
        params: {
          q: testProduct,
          city: testCity,
          product: testProduct,
          location: testCity
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
          'Connection': 'keep-alive'
        },
        timeout: 10000
      });
      
      console.log(`   Status: ${response.status}, Length: ${response.data.length}`);
      
      if (typeof response.data === 'object') {
        console.log(`   ✅ JSON response: ${JSON.stringify(response.data).substring(0, 200)}`);
      } else if (response.data.includes('results') || response.data.includes('price')) {
        console.log(`   ✅ Potential API response: ${response.data.substring(0, 200)}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
}

// Run the search
async function runSearch() {
  console.log('🚀 Searching for CHP New API...\n');
  
  await findCHPAPI();
  await testModernEndpoints();
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 API SEARCH SUMMARY');
  console.log('='.repeat(60));
  console.log('This will help us find CHP\'s new API endpoints.');
}

runSearch().catch(console.error);
