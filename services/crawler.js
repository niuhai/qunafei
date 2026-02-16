const axios = require('axios');
const cheerio = require('cheerio');
const config = require('../config');
const helpers = require('../utils/helpers');

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

function getRandomUA() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

async function fetchWithRetry(url, retries = config.crawler.maxRetries) {
  for (let i = 0; i < retries; i++) {
    try {
      await helpers.randomDelay(config.crawler.minDelay, config.crawler.maxDelay);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Referer': 'https://flights.ctrip.com/',
          'Cache-Control': 'no-cache'
        },
        timeout: config.crawler.timeout,
        validateStatus: (status) => status < 500
      });

      if (response.status === 200) {
        return response.data;
      }
      
      console.log(`Retry ${i + 1}: Status ${response.status}`);
    } catch (err) {
      console.log(`Retry ${i + 1} failed:`, err.message);
      if (i === retries - 1) throw err;
    }
  }
  return null;
}

function parseFlightData(html, fromCode, toCode) {
  const $ = cheerio.load(html);
  const flights = [];

  const scriptTags = $('script');
  let flightData = null;

  scriptTags.each((i, el) => {
    const content = $(el).html() || '';
    if (content.includes('flightList') || content.includes('flightData')) {
      const jsonMatch = content.match(/(?:flightList|flightData|flightDataList)\s*[=:]\s*(\[[\s\S]*?\]|{[\s\S]*?})\s*[;,]/);
      if (jsonMatch) {
        try {
          flightData = JSON.parse(jsonMatch[1]);
          return false;
        } catch (e) {
          console.log('JSON parse error:', e.message);
        }
      }
    }
  });

  if (flightData && Array.isArray(flightData)) {
    flightData.forEach(item => {
      flights.push({
        flightNo: item.flightNo || item.flightNumber || '',
        airline: item.airlineName || item.airline || '',
        from: fromCode,
        to: toCode,
        depTime: item.depTime || item.departureTime || '',
        arrTime: item.arrTime || item.arrivalTime || '',
        price: parseInt(item.price || item.lowestPrice || 0),
        discount: parseFloat(item.discount || 0),
        isDirect: item.isDirect !== false,
        aircraft: item.aircraftType || item.planeType || ''
      });
    });
  }

  return flights;
}

function generateMockFlights(fromCode, toCode, date) {
  const airlines = [
    { name: '中国国航', prefix: 'CA' },
    { name: '东方航空', prefix: 'MU' },
    { name: '南方航空', prefix: 'CZ' },
    { name: '海南航空', prefix: 'HU' },
    { name: '山东航空', prefix: 'SC' },
    { name: '厦门航空', prefix: 'MF' },
    { name: '深圳航空', prefix: 'ZH' },
    { name: '四川航空', prefix: '3U' }
  ];

  const flights = [];
  const numFlights = Math.floor(Math.random() * 5) + 3;
  const basePrice = Math.floor(Math.random() * 500) + 400;

  for (let i = 0; i < numFlights; i++) {
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    const flightNo = `${airline.prefix}${Math.floor(Math.random() * 9000) + 1000}`;
    const depHour = Math.floor(Math.random() * 12) + 6;
    const depMin = Math.floor(Math.random() * 60);
    const duration = Math.floor(Math.random() * 120) + 60;
    const arrHour = depHour + Math.floor(duration / 60);
    const arrMin = (depMin + duration % 60) % 60;
    const price = basePrice + Math.floor(Math.random() * 300);

    flights.push({
      flightNo,
      airline: airline.name,
      from: fromCode,
      to: toCode,
      depTime: `${String(depHour).padStart(2, '0')}:${String(depMin).padStart(2, '0')}`,
      arrTime: `${String(arrHour).padStart(2, '0')}:${String(arrMin).padStart(2, '0')}`,
      price,
      discount: Math.round((price / 1360) * 10) / 10,
      isDirect: Math.random() > 0.2,
      aircraft: ['Boeing 737', 'Airbus A320', 'Airbus A321', 'Boeing 787'][Math.floor(Math.random() * 4)]
    });
  }

  return flights.sort((a, b) => a.depTime.localeCompare(b.depTime));
}

async function searchFlights(fromCode, toCode, date) {
  const cacheKey = `${fromCode}-${toCode}-${date}`;
  
  const cached = helpers.getCachedFlights(cacheKey);
  if (cached) {
    console.log(`Using cached data for ${cacheKey}`);
    return { flights: cached, cached: true };
  }

  const url = `https://flights.ctrip.com/international/search/oneway-${fromCode}-${toCode}?depdate=${date}`;
  console.log(`Fetching flights from: ${url}`);

  try {
    const html = await fetchWithRetry(url);
    
    if (html) {
      const flights = parseFlightData(html, fromCode, toCode);
      
      if (flights.length > 0) {
        helpers.setCachedFlights(cacheKey, flights);
        return { flights, cached: false };
      }
    }

    console.log('Using mock data as fallback');
    const mockFlights = generateMockFlights(fromCode, toCode, date);
    helpers.setCachedFlights(cacheKey, mockFlights);
    return { flights: mockFlights, cached: false, mock: true };
    
  } catch (err) {
    console.error('Flight search error:', err.message);
    const mockFlights = generateMockFlights(fromCode, toCode, date);
    helpers.setCachedFlights(cacheKey, mockFlights);
    return { flights: mockFlights, cached: false, mock: true, error: err.message };
  }
}

async function searchMultiAirportFlights(fromCodes, toCode, date) {
  const results = [];
  
  for (const fromCode of fromCodes) {
    const result = await searchFlights(fromCode, toCode, date);
    results.push({
      fromCode,
      flights: result.flights,
      cached: result.cached,
      mock: result.mock
    });
  }
  
  return results;
}

module.exports = {
  searchFlights,
  searchMultiAirportFlights,
  generateMockFlights
};
