const express = require('express');
const router = express.Router();
const recommendService = require('../services/recommend');
const crawlerService = require('../services/crawler');
const distanceService = require('../services/distance');
const helpers = require('../utils/helpers');
const config = require('../config');

router.post('/recommend', async (req, res) => {
  const { 
    originCities, 
    originCity, 
    destination, 
    date, 
    radius, 
    preferences 
  } = req.body;

  const cities = originCities || (originCity ? [originCity] : []);
  
  if (cities.length === 0 || !destination || !date) {
    return res.json({
      code: 1,
      message: '请提供出发城市、目的地和日期'
    });
  }

  const radiusNum = parseInt(radius) || config.search.defaultRadius;
  const prefs = preferences || {};

  try {
    const allRecommendations = [];
    const processedAirports = new Set();

    for (const city of cities) {
      const nearbyResult = await distanceService.getNearbyAirports(city, radiusNum);
      
      if (nearbyResult.error) continue;

      const airportCodes = nearbyResult.airports
        .filter(a => !processedAirports.has(a.code))
        .map(a => {
          processedAirports.add(a.code);
          return a.code;
        });

      if (airportCodes.length === 0) continue;

      const flightResults = await crawlerService.searchMultiAirportFlights(
        airportCodes,
        destination,
        date
      );

      for (const airport of nearbyResult.airports) {
        if (!processedAirports.has(airport.code)) continue;
        
        const flightResult = flightResults.find(r => r.fromCode === airport.code);
        
        if (!flightResult || flightResult.flights.length === 0) continue;

        let filteredFlights = filterFlightsByPreferences(flightResult.flights, prefs);
        
        if (filteredFlights.length === 0) continue;

        const bestFlight = filteredFlights.sort((a, b) => a.price - b.price)[0];
        const transport = airport.transport;
        const totalCost = recommendService.calculateTotalCost(bestFlight, transport);
        const flightDuration = recommendService.getFlightDuration(bestFlight);
        const totalTime = transport.time + flightDuration;

        allRecommendations.push({
          originCity: city,
          airport: {
            code: airport.code,
            name: airport.name,
            city: airport.city,
            distance: airport.distance
          },
          flight: {
            flightNo: bestFlight.flightNo,
            airline: bestFlight.airline,
            depTime: bestFlight.depTime,
            arrTime: bestFlight.arrTime,
            price: bestFlight.price,
            isDirect: bestFlight.isDirect
          },
          transport: {
            type: transport.type,
            time: transport.time,
            cost: transport.cost,
            source: transport.source
          },
          totalCost,
          totalTime,
          savings: 0
        });
      }
    }

    const sorted = recommendService.sortRecommendations(allRecommendations, prefs.sortBy || config.search.defaultSortBy);

    if (sorted.length > 0 && cities.length === 1) {
      const localAirport = sorted.find(r => r.airport.city === cities[0]);
      const baseline = localAirport || sorted[0];
      
      sorted.forEach(r => {
        r.savings = baseline.totalCost.total - r.totalCost.total;
      });
    }

    saveSearchHistory(cities, destination, date);

    res.json({
      code: 0,
      data: {
        originCities: cities,
        destination,
        date,
        radius: radiusNum,
        recommendations: sorted,
        baseline: sorted.length > 0 ? {
          airport: sorted[0].airport.code,
          price: sorted[0].flight.price
        } : null
      }
    });

  } catch (err) {
    console.error('Recommend error:', err);
    res.json({
      code: 1,
      message: '推荐计算失败: ' + err.message
    });
  }
});

function filterFlightsByPreferences(flights, prefs) {
  return flights.filter(flight => {
    if (prefs.depTimeStart && flight.depTime < prefs.depTimeStart) return false;
    if (prefs.depTimeEnd && flight.depTime > prefs.depTimeEnd) return false;
    if (prefs.arrTimeStart && flight.arrTime < prefs.arrTimeStart) return false;
    if (prefs.arrTimeEnd && flight.arrTime > prefs.arrTimeEnd) return false;
    if (prefs.directOnly && !flight.isDirect) return false;
    if (prefs.minPrice && flight.price < prefs.minPrice) return false;
    if (prefs.maxPrice && flight.price > prefs.maxPrice) return false;
    if (prefs.maxTransportTime && prefs.transportTime) {
      if (prefs.transportTime > prefs.maxTransportTime) return false;
    }
    return true;
  });
}

function saveSearchHistory(cities, destination, date) {
  try {
    const userConfig = helpers.readJSON('config.json') || {};
    const recentSearches = userConfig.recentSearches || [];
    
    const searchKey = `${cities.join(',')}-${destination}-${date}`;
    const existingIndex = recentSearches.findIndex(
      s => `${s.from}-${s.to}-${s.date}` === searchKey
    );
    
    if (existingIndex >= 0) {
      recentSearches.splice(existingIndex, 1);
    }
    
    recentSearches.unshift({
      from: cities.join(','),
      to: destination,
      date,
      timestamp: new Date().toISOString()
    });
    
    userConfig.recentSearches = recentSearches.slice(0, 10);
    helpers.writeJSON('config.json', userConfig);
  } catch (err) {
    console.error('Save history error:', err);
  }
}

router.post('/cost', (req, res) => {
  const { flight, transport } = req.body;

  if (!flight || !transport) {
    return res.json({
      code: 1,
      message: '请提供航班和交通信息'
    });
  }

  const totalCost = recommendService.calculateTotalCost(flight, transport);

  res.json({
    code: 0,
    data: totalCost
  });
});

router.get('/history', (req, res) => {
  const userConfig = helpers.readJSON('config.json') || {};
  res.json({
    code: 0,
    data: userConfig.recentSearches || []
  });
});

router.delete('/history', (req, res) => {
  const userConfig = helpers.readJSON('config.json') || {};
  userConfig.recentSearches = [];
  helpers.writeJSON('config.json', userConfig);
  
  res.json({
    code: 0,
    message: '历史记录已清空'
  });
});

module.exports = router;
