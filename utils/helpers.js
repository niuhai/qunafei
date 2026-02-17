const fs = require('fs');
const path = require('path');
const config = require('../config');

const dataDir = path.join(__dirname, '..', 'data');

function readJSON(filename) {
  const filePath = path.join(dataDir, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filename}:`, err.message);
    return null;
  }
}

function writeJSON(filename, data) {
  const filePath = path.join(dataDir, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filename}:`, err.message);
    return false;
  }
}

function getAirports() {
  const data = readJSON('airports.json');
  return data ? data.airports : [];
}

function getCities() {
  const data = readJSON('airports.json');
  return data ? data.cities : {};
}

function resolveDestination(destInput) {
  const cities = getCities();
  const airports = getAirports();
  
  const input = destInput.trim();
  
  if (cities[input]) {
    const city = cities[input];
    
    if (city.alias && city.alias.length > 0) {
      const primaryCity = city.alias[0];
      const primaryAirport = airports.find(a => a.city === primaryCity && a.enabled);
      if (primaryAirport) {
        return {
          type: 'airport',
          code: primaryAirport.code,
          city: primaryCity,
          country: city.country
        };
      }
    }
    
    const directAirport = airports.find(a => a.city === input && a.enabled);
    if (directAirport) {
      return {
        type: 'airport',
        code: directAirport.code,
        city: input,
        country: city.country
      };
    }
    
    return {
      type: 'city',
      name: input,
      country: city.country,
      lat: city.lat,
      lng: city.lng
    };
  }
  
  const byCode = airports.find(a => a.code.toUpperCase() === input.toUpperCase() && a.enabled);
  if (byCode) {
    const cityData = cities[byCode.city];
    return {
      type: 'airport',
      code: byCode.code,
      city: byCode.city,
      country: cityData?.country || byCode.province
    };
  }
  
  const byName = airports.find(a => 
    (a.name.includes(input) || a.city === input) && a.enabled
  );
  if (byName) {
    const cityData = cities[byName.city];
    return {
      type: 'airport',
      code: byName.code,
      city: byName.city,
      country: cityData?.country || byName.province
    };
  }
  
  return {
    type: 'unknown',
    value: input
  };
}

function getCityCoordinate(cityName) {
  const cities = getCities();
  return cities[cityName] || null;
}

function getAirportByCode(code) {
  const airports = getAirports();
  return airports.find(a => a.code === code && a.enabled);
}

function getCache() {
  return readJSON('cache.json') || { flights: {} };
}

function setCache(cache) {
  return writeJSON('cache.json', cache);
}

function getCachedFlights(key) {
  const cache = getCache();
  const cached = cache.flights[key];
  
  if (!cached) return null;
  
  const now = new Date();
  const expiresAt = new Date(cached.expiresAt);
  
  if (now > expiresAt) {
    delete cache.flights[key];
    setCache(cache);
    return null;
  }
  
  return cached.data;
}

function setCachedFlights(key, data) {
  const cache = getCache();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.cache.expireMinutes * 60 * 1000);
  
  cache.flights[key] = {
    data,
    fetchedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
  
  setCache(cache);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  const delay = Math.random() * (max - min) + min;
  return sleep(delay);
}

module.exports = {
  readJSON,
  writeJSON,
  getAirports,
  getCities,
  getCityCoordinate,
  getAirportByCode,
  resolveDestination,
  getCache,
  setCache,
  getCachedFlights,
  setCachedFlights,
  sleep,
  randomDelay
};
