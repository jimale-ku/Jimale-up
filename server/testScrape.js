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
    const table = $('table');
    if (table.length === 0) {
      console.log('No table found in HTML!');
    } else {
      console.log('Table found!');
    }
  } catch (err) {
    console.error('Scraping error:', err);
  }
}

testScrape(); 