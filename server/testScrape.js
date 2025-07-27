const axios = require('axios');
const cheerio = require('cheerio');

async function testScrape() {
  try {
    const url = 'https://chp.co.il/main_page/compare_results';
    const params = {
      shopping_address: 'רמת גן', // Change to another real city if needed
      product_barcode: '7290011017866' // Replace with a real barcode from your client
    };
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
      'Referer': 'https://chp.co.il/',
    };
    const { data: html } = await axios.get(url, { params, headers });
    console.log('HTML length:', html.length);
    console.log('HTML preview:', html.slice(0, 500));
    
    const $ = cheerio.load(html);
    
    // Test multiple table selectors
    const tableSelectors = [
      '.results-table tbody tr',
      'table tbody tr',
      '.price-table tbody tr',
      'table tr'
    ];
    
    let foundTable = false;
    for (const selector of tableSelectors) {
      const table = $(selector);
      if (table.length > 0) {
        console.log(`Table found using selector: ${selector}`);
        console.log(`Number of rows: ${table.length}`);
        foundTable = true;
        
        // Test first few rows
        table.slice(0, 3).each((index, row) => {
          const tds = $(row).find('td');
          console.log(`Row ${index + 1}:`, {
            cells: tds.length,
            cellTexts: Array.from(tds).map((td, i) => ({ index: i, text: $(td).text().trim() }))
          });
        });
        break;
      }
    }
    
    if (!foundTable) {
      console.log('No table found with any selector!');
    }
    
    // Test product image extraction
    const productImgSelectors = [
      '.product-image img',
      '.item-image img', 
      'img[alt*="product"]',
      'img[src*="product"]',
      '.product img',
      '.item img'
    ];
    
    for (const selector of productImgSelectors) {
      const productImg = $(selector).first();
      if (productImg.length > 0) {
        const imageSrc = productImg.attr('src');
        console.log(`Product image found using selector: ${selector}`);
        console.log('Image src:', imageSrc);
        break;
      }
    }
    
  } catch (err) {
    console.error('Scraping error:', err);
  }
}

testScrape(); 