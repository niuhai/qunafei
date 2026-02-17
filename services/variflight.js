const axios = require('axios');
const config = require('../config');
const helpers = require('../utils/helpers');

const VARIFLIGHT_BASE_URL = 'https://api.variflight.com';

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

function getRandomUA() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

async function fetchWithRetry(url, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await helpers.randomDelay(500, 1500);
      
      const response = await axios.get(url, {
        params,
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'application/json',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        },
        timeout: 15000
      });

      if (response.data && response.data.code === 200) {
        return response.data;
      }
      
      console.log(`Variflight API returned: ${JSON.stringify(response.data)}`);
    } catch (err) {
      console.log(`Variflight API retry ${i + 1} failed:`, err.message);
      if (i === retries - 1) throw err;
    }
  }
  return null;
}

async function searchFlights(fromCode, toCode, date) {
  const cacheKey = `vf-${fromCode}-${toCode}-${date}`;
  
  const cached = helpers.getCachedFlights(cacheKey);
  if (cached) {
    console.log(`Using cached variflight data for ${cacheKey}`);
    return { flights: cached, cached: true, source: 'variflight' };
  }

  if (!config.variflight || !config.variflight.key) {
    console.log('Variflight API key not configured, using fallback');
    return { flights: [], cached: false, source: 'variflight', error: 'API key not configured' };
  }

  try {
    const result = await fetchWithRetry(
      `${VARIFLIGHT_BASE_URL}/api/flight`,
      {
        key: config.variflight.key,
        from: fromCode,
        to: toCode,
        date: date,
        type: 1
      }
    );

    if (result && result.data && Array.isArray(result.data)) {
      const flights = result.data.map(item => ({
        flightNo: item.flightNo || item.flight_no || '',
        airline: item.airline || item.airlineName || '',
        from: fromCode,
        to: toCode,
        depTime: item.depTime || item.dep_time || '',
        arrTime: item.arrTime || item.arr_time || '',
        price: parseInt(item.price || item.lowestPrice || 0),
        discount: parseFloat(item.discount || 0),
        isDirect: true,
        aircraft: item.aircraft || item.planeType || '',
        stops: 0
      }));

      helpers.setCachedFlights(cacheKey, flights);
      return { flights, cached: false, source: 'variflight' };
    }
  } catch (err) {
    console.error('Variflight search error:', err.message);
  }

  return { flights: [], cached: false, source: 'variflight', error: 'No data available' };
}

async function searchMultiAirportFlights(fromCodes, toCodes, date) {
  const results = [];
  
  for (const fromCode of fromCodes) {
    for (const toCode of toCodes) {
      const result = await searchFlights(fromCode, toCode, date);
      results.push({
        fromCode,
        toCode,
        flights: result.flights,
        cached: result.cached,
        source: result.source
      });
    }
  }
  
  return results;
}

async function getFlightPrice(fromCode, toCode, date) {
  const result = await searchFlights(fromCode, toCode, date);
  
  if (result.flights.length === 0) {
    return null;
  }

  const sortedFlights = result.flights.sort((a, b) => a.price - b.price);
  const cheapest = sortedFlights[0];
  
  return {
    minPrice: cheapest.price,
    avgPrice: Math.round(result.flights.reduce((sum, f) => sum + f.price, 0) / result.flights.length),
    flightCount: result.flights.length,
    cheapestFlight: cheapest
  };
}

async function getAirportInfo(code) {
  if (!config.variflight || !config.variflight.key) {
    return null;
  }

  try {
    const result = await fetchWithRetry(
      `${VARIFLIGHT_BASE_URL}/api/airport`,
      {
        key: config.variflight.key,
        code: code
      }
    );

    if (result && result.data) {
      return result.data;
    }
  } catch (err) {
    console.error('Variflight airport info error:', err.message);
  }

  return null;
}

module.exports = {
  searchFlights,
  searchMultiAirportFlights,
  getFlightPrice,
  getAirportInfo
};
