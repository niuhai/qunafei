const express = require('express');
const router = express.Router();
const routeOptimizer = require('../services/routeOptimizer');
const config = require('../config');

router.post('/optimize', async (req, res) => {
  const { 
    originCity, 
    destinationCity, 
    date, 
    radius, 
    maxStops,
    sortBy,
    dataSource
  } = req.body;

  if (!originCity || !destinationCity || !date) {
    return res.json({
      code: 1,
      message: '请提供出发城市、目的地城市和日期'
    });
  }

  try {
    const result = await routeOptimizer.findOptimalRoute(
      originCity,
      destinationCity,
      date,
      {
        radius: parseInt(radius) || config.search.defaultRadius,
        maxStops: parseInt(maxStops) || 1,
        sortBy: sortBy || config.search.defaultSortBy,
        dataSource: dataSource || 'variflight'
      }
    );

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

  } catch (err) {
    console.error('Route optimization error:', err);
    res.json({
      code: 1,
      message: '路径优化失败: ' + err.message
    });
  }
});

router.post('/compare', async (req, res) => {
  const { 
    originCity, 
    destinationCity, 
    date, 
    radius,
    dataSource
  } = req.body;

  if (!originCity || !destinationCity || !date) {
    return res.json({
      code: 1,
      message: '请提供出发城市、目的地城市和日期'
    });
  }

  try {
    const result = await routeOptimizer.compareRoutes(
      originCity,
      destinationCity,
      date,
      {
        radius: parseInt(radius) || config.search.defaultRadius,
        dataSource: dataSource || 'variflight'
      }
    );

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

  } catch (err) {
    console.error('Route comparison error:', err);
    res.json({
      code: 1,
      message: '路径对比失败: ' + err.message
    });
  }
});

router.get('/preview', async (req, res) => {
  const { originCity, destinationCity, radius } = req.query;

  if (!originCity || !destinationCity) {
    return res.json({
      code: 1,
      message: '请提供出发城市和目的地城市'
    });
  }

  try {
    const distanceService = require('../services/distance');
    const helpers = require('../utils/helpers');

    const originAirports = await distanceService.getNearbyAirports(
      originCity, 
      parseInt(radius) || config.search.defaultRadius
    );
    
    const destAirports = await distanceService.getNearbyAirports(
      destinationCity,
      parseInt(radius) || config.search.defaultRadius
    );

    if (originAirports.error || destAirports.error) {
      return res.json({
        code: 1,
        message: '城市不存在或周边无机场'
      });
    }

    const allAirports = helpers.getAirports();
    const potentialStops = allAirports.filter(a => 
      a.enabled && 
      !originAirports.airports.some(o => o.code === a.code) &&
      !destAirports.airports.some(d => d.code === a.code)
    );

    res.json({
      code: 0,
      data: {
        originAirports: originAirports.airports.map(a => ({
          code: a.code,
          name: a.name,
          city: a.city,
          distance: a.distance,
          transport: a.transport
        })),
        destAirports: destAirports.airports.map(a => ({
          code: a.code,
          name: a.name,
          city: a.city,
          distance: a.distance
        })),
        potentialStopCount: potentialStops.length,
        estimatedSearchTime: Math.ceil(
          (originAirports.airports.length * destAirports.airports.length * 2 +
          originAirports.airports.length * Math.min(potentialStops.length, 20) * 2) * 3
        ) + ' 秒'
      }
    });

  } catch (err) {
    console.error('Preview error:', err);
    res.json({
      code: 1,
      message: '预览失败: ' + err.message
    });
  }
});

module.exports = router;
