const express = require('express');
const router = express.Router();
const distanceService = require('../services/distance');
const helpers = require('../utils/helpers');
const config = require('../config');

router.get('/nearby', async (req, res) => {
  const { city, cities, radius } = req.query;
  
  const cityList = cities ? cities.split(',').map(c => c.trim()) : (city ? [city] : []);
  
  if (cityList.length === 0) {
    return res.json({
      code: 1,
      message: '请提供城市名称'
    });
  }

  const radiusNum = parseInt(radius) || config.search.defaultRadius;
  
  if (cityList.length === 1) {
    const result = await distanceService.getNearbyAirports(cityList[0], radiusNum);

    if (result.error) {
      return res.json({
        code: 1,
        message: result.error
      });
    }

    res.json({
      code: 0,
      data: result
    });
  } else {
    const results = [];
    const processedAirports = new Set();
    
    for (const cityName of cityList) {
      const result = await distanceService.getNearbyAirports(cityName, radiusNum);
      
      if (result.error) continue;
      
      result.airports.forEach(airport => {
        if (!processedAirports.has(airport.code)) {
          processedAirports.add(airport.code);
          results.push({
            ...airport,
            originCity: cityName
          });
        }
      });
    }
    
    results.sort((a, b) => a.distance - b.distance);
    
    res.json({
      code: 0,
      data: {
        cities: cityList,
        radius: radiusNum,
        airports: results
      }
    });
  }
});

router.get('/search', (req, res) => {
  const { keyword } = req.query;
  const airports = distanceService.getAirportsByFilter(keyword);
  
  res.json({
    code: 0,
    data: airports
  });
});

router.get('/:code', (req, res) => {
  const { code } = req.params;
  const result = distanceService.getAirportInfo(code.toUpperCase());

  if (result.error) {
    return res.json({
      code: 1,
      message: result.error
    });
  }

  res.json({
    code: 0,
    data: result
  });
});

router.get('/cities/all', (req, res) => {
  const cities = helpers.getCities();
  res.json({
    code: 0,
    data: Object.keys(cities).map(name => ({
      name,
      ...cities[name]
    }))
  });
});

router.get('/cities/search', (req, res) => {
  const { keyword } = req.query;
  const cities = helpers.getCities();
  
  let result = Object.keys(cities).map(name => ({
    name,
    ...cities[name]
  }));
  
  if (keyword) {
    result = result.filter(c => 
      c.name.includes(keyword) || 
      c.name.toLowerCase().startsWith(keyword.toLowerCase())
    );
  }
  
  res.json({
    code: 0,
    data: result.slice(0, 20)
  });
});

module.exports = router;
