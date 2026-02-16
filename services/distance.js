const axios = require('axios');
const config = require('../config');
const geo = require('../utils/geo');
const helpers = require('../utils/helpers');

async function getCityCoordinate(cityName) {
  if (config.amap.key) {
    try {
      const response = await axios.get(config.amap.geocodeUrl, {
        params: {
          key: config.amap.key,
          address: cityName
        },
        timeout: 5000
      });

      if (response.data.status === '1' && response.data.geocodes && response.data.geocodes.length > 0) {
        const [lng, lat] = response.data.geocodes[0].location.split(',');
        return { 
          lat: parseFloat(lat), 
          lng: parseFloat(lng),
          source: 'amap'
        };
      }
    } catch (err) {
      console.log('高德API调用失败，使用内置数据:', err.message);
    }
  }

  const cities = helpers.getCities();
  return cities[cityName] ? { ...cities[cityName], source: 'builtin' } : null;
}

async function getTransportInfo(origin, destination) {
  if (config.amap.key) {
    try {
      const response = await axios.get(config.amap.directionUrl, {
        params: {
          key: config.amap.key,
          origin: `${origin.lng},${origin.lat}`,
          destination: `${destination.lng},${destination.lat}`,
          strategy: 0
        },
        timeout: 10000
      });

      if (response.data.status === '1' && response.data.route && response.data.route.paths.length > 0) {
        const path = response.data.route.paths[0];
        return {
          distance: Math.round(parseInt(path.distance) / 100) / 10,
          time: Math.round(parseInt(path.duration) / 60),
          cost: parseInt(path.tolls) || 0,
          type: 'car',
          source: 'amap'
        };
      }
    } catch (err) {
      console.log('高德路径规划失败，使用估算:', err.message);
    }
  }

  const distance = geo.getDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  return estimateTransport(distance);
}

function estimateTransport(distance) {
  if (distance === 0) {
    return { type: 'local', time: 0, cost: 0, distance: 0, source: 'estimate' };
  }

  const transportConfig = config.transport;
  
  const trainTime = Math.round(distance / transportConfig.train.speedKmh * 60);
  const trainCost = Math.round(distance * transportConfig.train.costPerKm);
  
  const carTime = Math.round(distance / transportConfig.car.speedKmh * 60);
  const carCost = Math.round(distance * transportConfig.car.costPerKm);

  if (trainTime <= carTime && trainCost <= carCost) {
    return { type: 'train', time: trainTime, cost: trainCost, distance: Math.round(distance * 10) / 10, source: 'estimate' };
  }
  
  return { type: 'car', time: carTime, cost: carCost, distance: Math.round(distance * 10) / 10, source: 'estimate' };
}

async function getNearbyAirports(cityName, radius = config.search.defaultRadius) {
  const cityCoord = await getCityCoordinate(cityName);
  if (!cityCoord) {
    return { error: '城市不存在', code: 'CITY_NOT_FOUND' };
  }

  const airports = helpers.getAirports();
  const nearbyAirports = [];

  for (const airport of airports) {
    if (!airport.enabled) continue;
    
    const distance = geo.getDistance(cityCoord.lat, cityCoord.lng, airport.lat, airport.lng);
    if (distance <= radius) {
      const transport = await getTransportInfo(cityCoord, { lat: airport.lat, lng: airport.lng });
      nearbyAirports.push({
        code: airport.code,
        name: airport.name,
        city: airport.city,
        province: airport.province,
        lat: airport.lat,
        lng: airport.lng,
        distance: transport.distance || Math.round(distance * 10) / 10,
        transport
      });
    }
  }

  nearbyAirports.sort((a, b) => a.distance - b.distance);

  return {
    city: cityName,
    coordinate: cityCoord,
    radius,
    airports: nearbyAirports
  };
}

function getAirportsByFilter(keyword) {
  const airports = helpers.getAirports();
  if (!keyword) {
    return airports.filter(a => a.enabled);
  }

  const lowerKeyword = keyword.toLowerCase();
  return airports.filter(a => 
    a.enabled && (
      a.code.toLowerCase().includes(lowerKeyword) ||
      a.name.includes(keyword) ||
      a.city.includes(keyword)
    )
  );
}

function getAirportInfo(code) {
  const airport = helpers.getAirportByCode(code);
  if (!airport) {
    return { error: '机场不存在', code: 'AIRPORT_NOT_FOUND' };
  }
  return airport;
}

module.exports = {
  getCityCoordinate,
  getTransportInfo,
  estimateTransport,
  getNearbyAirports,
  getAirportsByFilter,
  getAirportInfo
};
