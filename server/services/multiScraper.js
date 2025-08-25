// server/services/multiScraper.js
const axios = require('axios');
const cheerio = require('cheerio');

class MultiScraper {
  constructor() {
    this.sources = {
      chp: {
        name: 'CHP Price Comparison',
        baseUrl: 'https://chp.co.il/main_page/compare_results',
        enabled: true
      },
      shufersal: {
         name: 'Shufersal',
         baseUrl: 'https://www.shufersal.co.il',
         enabled: false // Disabled - not working (441 char responses)
       },
       ramiLevy: {
         name: 'Rami Levy',
         baseUrl: 'https://www.rami-levy.co.il',
         enabled: false // Temporarily disabled due to 403 errors
       }
    };
  }

  // Main scraping function that tries multiple sources
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

  // Search in specific source
  async searchInSource(sourceKey, city, searchTerm) {
    switch (sourceKey) {
      case 'chp':
        return await this.searchCHP(city, searchTerm);
      case 'shufersal':
        return await this.searchShufersal(city, searchTerm);
      case 'ramiLevy':
        return await this.searchRamiLevy(city, searchTerm);
      default:
        return [];
    }
  }

  // CHP scraping with autocompletion (NEW WORKING LOGIC)
  async searchCHP(city, searchTerm) {
    try {
      // Step 1: Get product suggestions from autocompletion API
      console.log(`🔍 CHP: Getting product suggestions for "${searchTerm}"`);
      
      const autocompletionResponse = await axios.get('https://chp.co.il/autocompletion/product_extended', {
        params: {
          term: searchTerm,
          limit: 10
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
          'Connection': 'keep-alive',
          'Referer': 'https://chp.co.il/',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 15000
      });
      
      if (!autocompletionResponse.data || autocompletionResponse.data.length === 0) {
        console.log(`❌ CHP: No product suggestions found for "${searchTerm}"`);
        return [];
      }
      
      console.log(`✅ CHP: Found ${autocompletionResponse.data.length} product suggestions`);
      
      // Step 2: Try each suggested product
      const allResults = [];
      
      for (const suggestion of autocompletionResponse.data) {
        if (suggestion.id === 'next') continue; // Skip "show more" option
        
        const productId = suggestion.id;
        const productName = suggestion.value;
        
        console.log(`🔍 CHP: Trying product "${productName}" (ID: ${productId})`);
        
        try {
          // Step 3: Get city ID from autocompletion
          const cityResponse = await axios.get('https://chp.co.il/autocompletion/shopping_address', {
            params: {
              term: city,
              limit: 5
            },
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
              'Connection': 'keep-alive',
              'Referer': 'https://chp.co.il/',
              'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 10000
          });
          
          let cityId = '8600_9000'; // Default fallback
          if (cityResponse.data && cityResponse.data.length > 0) {
            cityId = cityResponse.data[0].id;
          }
          
          // Step 4: Get price comparison using the correct product ID
          const compareResponse = await axios.post('https://chp.co.il/main_page/compare_results', {
            shopping_address: city,
            shopping_address_street_id: 9000,
            shopping_address_city_id: 0,
            product_barcode: productId,
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
          
          // Check if we got results (not "product not found")
          if (compareResponse.data.includes('המוצר שחיפשתם לא נמצא')) {
            console.log(`❌ CHP: Product not found for "${productName}"`);
            continue;
          }
          
          // Parse the results
          const $ = cheerio.load(compareResponse.data);
          const results = [];

          // Parse CHP results with flexible column detection
          $('.results-table tbody tr').each((i, row) => {
            const $row = $(row);
            const cells = $row.find('td');
            
            if (cells.length >= 5) {
              const storeName = cells.eq(0).text().trim();
              const branch = cells.eq(1).text().trim();
              const address = cells.eq(2).text().trim();
              
              // Try to find price in different columns
              let priceText = '';
              let quantityText = '';
              
              // Get text from columns 4 and 5
              const col4Text = cells.eq(3).text().trim();
              const col5Text = cells.eq(4).text().trim();
              
              // Priority: Column 4 (discounted price) if available, otherwise Column 5 (original price)
              if (/^\d+\.?\d*$/.test(col4Text)) {
                // Column 4 has a valid price (discounted price)
                priceText = col4Text;
                quantityText = col5Text;
              } else if (/^\d+\.?\d*$/.test(col5Text)) {
                // Column 4 is empty/invalid, use Column 5 (original price)
                priceText = col5Text;
                quantityText = col4Text;
              }
              
              if (branch && address && priceText) {
                const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                const quantity = parseInt(quantityText.replace(/[^\d]/g, '')) || 1;
                
                if (!isNaN(price) && price > 0) {
                  results.push({
                    source: 'chp',
                    branch,
                    address,
                    price,
                    quantity,
                    searchTerm: productName // Use the actual product name that worked
                  });
                }
              }
            }
          });
          
          if (results.length > 0) {
            console.log(`✅ CHP: Found ${results.length} results for "${productName}"`);
            allResults.push(...results);
            break; // Found results, no need to try more suggestions
          }
          
        } catch (error) {
          console.error(`❌ CHP: Error with product "${productName}":`, error.message);
          continue;
        }
      }
      
      console.log(`✅ CHP: Total results found: ${allResults.length}`);
      return allResults;
      
    } catch (error) {
      console.error('CHP scraping error:', error.message);
      return [];
    }
  }



  // Shufersal scraping - Real web scraping
  async searchShufersal(city, searchTerm) {
    try {
      // Shufersal search page - try main site with better approach
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'Referer': 'https://www.shufersal.co.il/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };

      // Try different search approaches
      const searchAttempts = [
        { url: 'https://www.shufersal.co.il', params: { q: searchTerm } },
        { url: 'https://www.shufersal.co.il/online', params: { search: searchTerm } },
        { url: 'https://www.shufersal.co.il', params: { query: searchTerm } }
      ];

      for (const attempt of searchAttempts) {
        try {
          const response = await axios.get(attempt.url, { 
            params: attempt.params,
            headers,
            timeout: 8000
          });

          console.log(`📄 Shufersal response status: ${response.status}`);
          console.log(`📄 Shufersal response length: ${response.data.length} characters`);

          // If response is too short, it's likely an error page
          if (response.data.length < 1000) {
            console.log(`⚠️ Shufersal response too short, trying next attempt...`);
            continue;
          }

          const $ = cheerio.load(response.data);
          const results = [];

          // Try multiple selectors for Shufersal's product structure
          const selectors = [
            '.product-item',
            '.product-card', 
            '.item-card',
            '.product',
            '[data-product]',
            '.search-result-item',
            '.catalog-item'
          ];

          for (const selector of selectors) {
            $(selector).each((i, element) => {
              const $element = $(element);
              
              // Try different selectors for product name
              const productName = $element.find('.product-name, .item-name, .title, h3, h4, .name, .product-title').first().text().trim();
              
              // Try different selectors for price
              const priceText = $element.find('.price, .product-price, .item-price, .cost, .amount, .product-cost').first().text().trim();
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

          // If we get here, no results found with any selector
          console.log(`❌ Shufersal found no results with any selector`);
          return [];

        } catch (error) {
          console.log(`⚠️ Shufersal attempt failed: ${error.message}`);
          continue;
        }
      }
      
      return [];
    } catch (error) {
      console.error('Shufersal scraping error:', error.message);
      return [];
    }
  }

  // Rami Levy scraping - Real web scraping
  async searchRamiLevy(city, searchTerm) {
    try {
      // Rami Levy search page - try main site
      const searchUrl = 'https://www.rami-levy.co.il';
      
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'Referer': 'https://www.rami-levy.co.il/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1'
      };

      const params = {
        search: searchTerm
      };

      const response = await axios.get(searchUrl, { 
        params,
        headers,
        timeout: 8000
      });

      console.log(`📄 Rami Levy response status: ${response.status}`);
      console.log(`📄 Rami Levy response length: ${response.data.length} characters`);

      const $ = cheerio.load(response.data);
      const results = [];

      // Parse Rami Levy product cards
      $('.product-card, .product-item, .item-card, .product').each((i, element) => {
        const $element = $(element);
        
        // Try different selectors for product name
        const productName = $element.find('.product-name, .item-name, .title, h3, h4, .name').first().text().trim();
        
        // Try different selectors for price
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

      // If no results with product cards, try alternative selectors
      if (results.length === 0) {
        $('.item, [data-product], .product-item').each((i, element) => {
          const $element = $(element);
          const productName = $element.find('[data-name], .name, .title, .product-title').first().text().trim();
          const priceText = $element.find('[data-price], .price, .cost, .product-price').first().text().trim();
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
      }
      
      return results;
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

module.exports = MultiScraper;
