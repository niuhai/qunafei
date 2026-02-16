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
  getCache,
  setCache,
  getCachedFlights,
  setCachedFlights,
  sleep,
  randomDelay
};
