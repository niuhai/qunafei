const express = require('express');
const router = express.Router();
const crawlerService = require('../services/crawler');
const config = require('../config');

router.get('/search', async (req, res) => {
  const { from, to, date, depTimeStart, depTimeEnd, arrTimeStart, arrTimeEnd, directOnly, minPrice, maxPrice } = req.query;

  if (!from || !to || !date) {
    return res.json({
      code: 1,
      message: '请提供出发机场、目的地和日期'
    });
  }

  const fromCodes = from.split(',').map(c => c.trim().toUpperCase());
  const toCode = to.toUpperCase();

  try {
    if (fromCodes.length === 1) {
      const result = await crawlerService.searchFlights(fromCodes[0], toCode, date);
      let flights = filterFlights(result.flights, {
        depTimeStart,
        depTimeEnd,
        arrTimeStart,
        arrTimeEnd,
        directOnly: directOnly === 'true',
        minPrice: minPrice ? parseInt(minPrice) : null,
        maxPrice: maxPrice ? parseInt(maxPrice) : null
      });
      
      res.json({
        code: 0,
        data: flights,
        cached: result.cached,
        mock: result.mock,
        cacheTime: new Date().toISOString()
      });
    } else {
      const results = await crawlerService.searchMultiAirportFlights(fromCodes, toCode, date);
      let allFlights = results.flatMap(r => 
        filterFlights(r.flights, {
          depTimeStart,
          depTimeEnd,
          arrTimeStart,
          arrTimeEnd,
          directOnly: directOnly === 'true',
          minPrice: minPrice ? parseInt(minPrice) : null,
          maxPrice: maxPrice ? parseInt(maxPrice) : null
        }).map(f => ({ ...f, fromCode: r.fromCode }))
      );
      
      allFlights.sort((a, b) => a.price - b.price);
      
      res.json({
        code: 0,
        data: allFlights,
        details: results.map(r => ({
          from: r.fromCode,
          count: r.flights.length,
          cached: r.cached,
          mock: r.mock
        })),
        cacheTime: new Date().toISOString()
      });
    }
  } catch (err) {
    res.json({
      code: 1,
      message: '航班查询失败: ' + err.message
    });
  }
});

function filterFlights(flights, filters) {
  return flights.filter(flight => {
    if (filters.depTimeStart && flight.depTime < filters.depTimeStart) return false;
    if (filters.depTimeEnd && flight.depTime > filters.depTimeEnd) return false;
    if (filters.arrTimeStart && flight.arrTime < filters.arrTimeStart) return false;
    if (filters.arrTimeEnd && flight.arrTime > filters.arrTimeEnd) return false;
    if (filters.directOnly && !flight.isDirect) return false;
    if (filters.minPrice && flight.price < filters.minPrice) return false;
    if (filters.maxPrice && flight.price > filters.maxPrice) return false;
    return true;
  });
}

router.get('/mock', (req, res) => {
  const { from, to } = req.query;
  const fromCode = (from || 'YNT').toUpperCase();
  const toCode = (to || 'SHA').toUpperCase();
  
  const flights = crawlerService.generateMockFlights(fromCode, toCode, '2026-02-20');
  
  res.json({
    code: 0,
    data: flights,
    mock: true
  });
});

module.exports = router;
