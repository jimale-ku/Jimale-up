// Alternative scraper for when CHP is blocked
const axios = require('axios');
const cheerio = require('cheerio');

class AlternativeScraper {
  constructor() {
    this.sources = {
      // Try other Israeli price comparison sites
      zap: {
        name: 'Zap',
        baseUrl: 'https://www.zap.co.il',
        enabled: false // Disabled for now
      },
      // Try direct supermarket APIs
      shufersal: {
        name: 'Shufersal Direct',
        baseUrl: 'https://www.shufersal.co.il',
        enabled: true
      },
      ramiLevy: {
        name: 'Rami Levy Direct',
        baseUrl: 'https://www.rami-levy.co.il',
        enabled: true
      },
      // Mock data for testing
      mock: {
        name: 'Mock Data',
        enabled: true
      }
    };
  }

  async searchProduct(city, searchTerm) {
    const results = [];
    
    // Try each enabled source
    for (const [sourceKey, source] of Object.entries(this.sources)) {
      if (!source.enabled) continue;
      
      try {
        console.log(`🔍 Trying ${source.name} for: ${searchTerm}`);
        const sourceResults = await this.searchInSource(sourceKey, city, searchTerm);
        
        if (sourceResults && sourceResults.length > 0) {
          console.log(`✅ ${source.name} found ${sourceResults.length} results`);
          results.push(...sourceResults);
        } else {
          console.log(`❌ ${source.name} found no results`);
        }
      } catch (error) {
        console.error(`❌ Error with ${source.name}:`, error.message);
      }
    }
    
    return results;
  }

  async searchInSource(sourceKey, city, searchTerm) {
    switch (sourceKey) {
      case 'shufersal':
        return await this.searchShufersal(city, searchTerm);
      case 'ramiLevy':
        return await this.searchRamiLevy(city, searchTerm);
      case 'mock':
        return await this.getMockData(city, searchTerm);
      default:
        return [];
    }
  }

  // Mock data for testing when real sources are blocked
  async getMockData(city, searchTerm) {
    console.log(`🎭 Generating mock data for "${searchTerm}" in "${city}"`);
    
    // Generate realistic mock data based on the search term
    const mockStores = [
      {
        source: 'mock',
        branch: 'Shufersal',
        address: `${city}, רחוב הרצל 123`,
        price: this.generateMockPrice(searchTerm),
        quantity: 1,
        searchTerm
      },
      {
        source: 'mock',
        branch: 'Rami Levy',
        address: `${city}, רחוב ויצמן 456`,
        price: this.generateMockPrice(searchTerm),
        quantity: 1,
        searchTerm
      },
      {
        source: 'mock',
        branch: 'Coop',
        address: `${city}, רחוב בן גוריון 789`,
        price: this.generateMockPrice(searchTerm),
        quantity: 1,
        searchTerm
      }
    ];
    
    // Filter based on search term
    if (searchTerm.includes('דבש') || searchTerm.includes('honey')) {
      return mockStores.map(store => ({
        ...store,
        price: 15.90 + Math.random() * 5 // Honey prices around 15-20₪
      }));
    }
    
    return mockStores;
  }

  generateMockPrice(searchTerm) {
    // Generate realistic prices based on product type
    if (searchTerm.includes('דבש') || searchTerm.includes('honey')) {
      return 15.90 + Math.random() * 5; // 15-20₪
    } else if (searchTerm.includes('חלב') || searchTerm.includes('milk')) {
      return 8.50 + Math.random() * 3; // 8-11₪
    } else if (searchTerm.includes('לחם') || searchTerm.includes('bread')) {
      return 12.00 + Math.random() * 4; // 12-16₪
    } else {
      return 10.00 + Math.random() * 15; // 10-25₪
    }
  }

  // Enhanced Shufersal scraping
  async searchShufersal(city, searchTerm) {
    try {
      console.log(`🔍 Searching Shufersal for: ${searchTerm}`);
      
      // Try multiple Shufersal endpoints
      const endpoints = [
        'https://www.shufersal.co.il/online',
        'https://www.shufersal.co.il/online/search',
        'https://www.shufersal.co.il'
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await axios.get(endpoint, {
            params: { q: searchTerm },
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
              'Connection': 'keep-alive',
              'Referer': 'https://www.shufersal.co.il/',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            timeout: 10000
          });
          
          if (response.data.length > 1000) {
            const $ = cheerio.load(response.data);
            const results = [];
            
            // Try multiple selectors for Shufersal
            const selectors = [
              '.product-item',
              '.product-card',
              '.item-card',
              '.product',
              '[data-product]',
              '.search-result-item'
            ];
            
            for (const selector of selectors) {
              $(selector).each((i, element) => {
                const $element = $(element);
                const productName = $element.find('.product-name, .item-name, .title, h3, h4, .name').first().text().trim();
                const priceText = $element.find('.price, .product-price, .item-price, .cost, .amount').first().text().trim();
                const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                
                if (productName && !isNaN(price) && price > 0) {
                  results.push({
                    source: 'shufersal',
                    branch: 'Shufersal Online',
                    address: city,
                    price: price,
                    quantity: 1,
                    searchTerm,
                    productName: productName
                  });
                }
              });
              
              if (results.length > 0) {
                console.log(`✅ Shufersal found ${results.length} results with selector: ${selector}`);
                return results;
              }
            }
          }
          
        } catch (error) {
          console.log(`⚠️ Shufersal endpoint ${endpoint} failed: ${error.message}`);
          continue;
        }
      }
      
      return [];
      
    } catch (error) {
      console.error('Shufersal scraping error:', error.message);
      return [];
    }
  }

  // Enhanced Rami Levy scraping
  async searchRamiLevy(city, searchTerm) {
    try {
      console.log(`🔍 Searching Rami Levy for: ${searchTerm}`);
      
      const response = await axios.get('https://www.rami-levy.co.il', {
        params: { search: searchTerm },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
          'Connection': 'keep-alive',
          'Referer': 'https://www.rami-levy.co.il/',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      const results = [];
      
      // Try multiple selectors for Rami Levy
      const selectors = [
        '.product-card',
        '.product-item',
        '.item-card',
        '.product',
        '[data-product]'
      ];
      
      for (const selector of selectors) {
        $(selector).each((i, element) => {
          const $element = $(element);
          const productName = $element.find('.product-name, .item-name, .title, h3, h4, .name').first().text().trim();
          const priceText = $element.find('.price, .product-price, .item-price, .cost, .amount').first().text().trim();
          const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
          
          if (productName && !isNaN(price) && price > 0) {
            results.push({
              source: 'ramiLevy',
              branch: 'Rami Levy Online',
              address: city,
              price: price,
              quantity: 1,
              searchTerm,
              productName: productName
            });
          }
        });
        
        if (results.length > 0) {
          console.log(`✅ Rami Levy found ${results.length} results with selector: ${selector}`);
          return results;
        }
      }
      
      return [];
      
    } catch (error) {
      console.error('Rami Levy scraping error:', error.message);
      return [];
    }
  }

  // Aggregate results from multiple sources
  aggregateResults(allResults) {
    const storeMap = new Map();
    
    for (const result of allResults) {
      const storeKey = `${result.source}_${result.branch}`;
      
      if (!storeMap.has(storeKey)) {
        storeMap.set(storeKey, {
          source: result.source,
          branch: result.branch,
          address: result.address,
          totalPrice: 0,
          itemsFound: 0,
          itemPrices: {},
          productDetails: {}
        });
      }
      
      const store = storeMap.get(storeKey);
      store.totalPrice += result.price;
      store.itemsFound += 1;
      store.itemPrices[result.searchTerm] = result.price;
      store.productDetails[result.searchTerm] = {
        name: result.searchTerm,
        price: result.price,
        quantity: result.quantity
      };
    }
    
    return Array.from(storeMap.values());
  }
}

module.exports = AlternativeScraper;
