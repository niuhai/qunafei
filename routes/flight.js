const express = require('express');
const router = express.Router();
const crawlerService = require('../services/crawler');
const helpers = require('../utils/helpers');
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

router.get('/flexible', async (req, res) => {
  const { from, to, date, days = 3 } = req.query;

  if (!from || !to || !date) {
    return res.json({
      code: 1,
      message: '请提供出发机场、目的地和日期'
    });
  }

  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();
  const daysNum = Math.min(parseInt(days) || 3, 7);

  try {
    const results = [];
    const baseDate = new Date(date);

    for (let i = -daysNum; i <= daysNum; i++) {
      const targetDate = new Date(baseDate);
      targetDate.setDate(baseDate.getDate() + i);
      const dateStr = targetDate.toISOString().split('T')[0];

      const result = await crawlerService.searchFlights(fromCode, toCode, dateStr);
      
      if (result.flights && result.flights.length > 0) {
        const minPrice = Math.min(...result.flights.map(f => f.price));
        const minPriceFlight = result.flights.find(f => f.price === minPrice);
        
        results.push({
          date: dateStr,
          dayOffset: i,
          weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][targetDate.getDay()],
          minPrice,
          flightCount: result.flights.length,
          bestFlight: minPriceFlight,
          cached: result.cached,
          mock: result.mock
        });
      } else {
        results.push({
          date: dateStr,
          dayOffset: i,
          weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][targetDate.getDay()],
          minPrice: null,
          flightCount: 0,
          bestFlight: null
        });
      }
    }

    results.sort((a, b) => {
      if (a.minPrice === null) return 1;
      if (b.minPrice === null) return -1;
      return a.minPrice - b.minPrice;
    });

    const destAirport = helpers.getAirportByCode(toCode);
    const fromAirport = helpers.getAirportByCode(fromCode);

    res.json({
      code: 0,
      data: {
        originDate: date,
        from: fromCode,
        fromName: fromAirport ? fromAirport.name : fromCode,
        to: toCode,
        toName: destAirport ? destAirport.name : toCode,
        searchRange: daysNum,
        results,
        bestDate: results.find(r => r.minPrice !== null) || null
      }
    });

  } catch (err) {
    res.json({
      code: 1,
      message: '灵活日期查询失败: ' + err.message
    });
  }
});

router.get('/calendar', async (req, res) => {
  const { from, to, year, month } = req.query;

  if (!from || !to) {
    return res.json({
      code: 1,
      message: '请提供出发机场和目的地'
    });
  }

  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();
  const now = new Date();
  const targetYear = parseInt(year) || now.getFullYear();
  const targetMonth = parseInt(month) || (now.getMonth() + 1);

  try {
    const calendar = [];
    const firstDay = new Date(targetYear, targetMonth - 1, 1);
    const lastDay = new Date(targetYear, targetMonth, 0);
    const daysInMonth = lastDay.getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const targetDate = new Date(targetYear, targetMonth - 1, day);
      const dateStr = targetDate.toISOString().split('T')[0];
      
      if (targetDate < now) {
        calendar.push({
          date: dateStr,
          day,
          weekday: targetDate.getDay(),
          weekdayName: ['日', '一', '二', '三', '四', '五', '六'][targetDate.getDay()],
          minPrice: null,
          status: 'past'
        });
        continue;
      }

      const result = await crawlerService.searchFlights(fromCode, toCode, dateStr);
      
      if (result.flights && result.flights.length > 0) {
        const minPrice = Math.min(...result.flights.map(f => f.price));
        const avgPrice = Math.round(result.flights.reduce((sum, f) => sum + f.price, 0) / result.flights.length);
        
        calendar.push({
          date: dateStr,
          day,
          weekday: targetDate.getDay(),
          weekdayName: ['日', '一', '二', '三', '四', '五', '六'][targetDate.getDay()],
          minPrice,
          avgPrice,
          flightCount: result.flights.length,
          status: 'available',
          cached: result.cached,
          mock: result.mock
        });
      } else {
        calendar.push({
          date: dateStr,
          day,
          weekday: targetDate.getDay(),
          weekdayName: ['日', '一', '二', '三', '四', '五', '六'][targetDate.getDay()],
          minPrice: null,
          status: 'no_flight'
        });
      }
    }

    const availableDays = calendar.filter(d => d.minPrice !== null);
    const lowestPrice = availableDays.length > 0 ? Math.min(...availableDays.map(d => d.minPrice)) : null;
    const highestPrice = availableDays.length > 0 ? Math.max(...availableDays.map(d => d.minPrice)) : null;

    res.json({
      code: 0,
      data: {
        year: targetYear,
        month: targetMonth,
        from: fromCode,
        to: toCode,
        calendar,
        summary: {
          lowestPrice,
          highestPrice,
          avgPrice: availableDays.length > 0 
            ? Math.round(availableDays.reduce((sum, d) => sum + d.minPrice, 0) / availableDays.length)
            : null,
          availableDays: availableDays.length,
          totalDays: daysInMonth
        }
      }
    });

  } catch (err) {
    res.json({
      code: 1,
      message: '价格日历查询失败: ' + err.message
    });
  }
});

router.get('/range', async (req, res) => {
  const { from, to, startDate, endDate } = req.query;

  if (!from || !to || !startDate) {
    return res.json({
      code: 1,
      message: '请提供出发机场、目的地和开始日期'
    });
  }

  const fromCode = from.toUpperCase();
  const toCode = to.toUpperCase();
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(startDate);
  
  if (end < start) {
    return res.json({
      code: 1,
      message: '结束日期不能早于开始日期'
    });
  }

  const maxDays = 14;
  const dayDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  if (dayDiff > maxDays) {
    return res.json({
      code: 1,
      message: `日期范围不能超过${maxDays}天`
    });
  }

  try {
    const results = [];
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const result = await crawlerService.searchFlights(fromCode, toCode, dateStr);
      
      if (result.flights && result.flights.length > 0) {
        const prices = result.flights.map(f => f.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
        const minPriceFlight = result.flights.find(f => f.price === minPrice);
        
        results.push({
          date: dateStr,
          weekday: weekdays[d.getDay()],
          minPrice,
          maxPrice,
          avgPrice,
          flightCount: result.flights.length,
          bestFlight: minPriceFlight,
          allFlights: result.flights,
          cached: result.cached,
          mock: result.mock
        });
      } else {
        results.push({
          date: dateStr,
          weekday: weekdays[d.getDay()],
          minPrice: null,
          maxPrice: null,
          avgPrice: null,
          flightCount: 0,
          bestFlight: null,
          allFlights: []
        });
      }
    }

    const validResults = results.filter(r => r.minPrice !== null);
    const lowestPrice = validResults.length > 0 ? Math.min(...validResults.map(r => r.minPrice)) : null;
    const bestDate = validResults.find(r => r.minPrice === lowestPrice) || null;

    res.json({
      code: 0,
      data: {
        startDate,
        endDate: endDate || startDate,
        from: fromCode,
        to: toCode,
        totalDays: results.length,
        availableDays: validResults.length,
        lowestPrice,
        highestPrice: validResults.length > 0 ? Math.max(...validResults.map(r => r.maxPrice)) : null,
        avgPrice: validResults.length > 0 
          ? Math.round(validResults.reduce((sum, r) => sum + r.avgPrice, 0) / validResults.length)
          : null,
        results,
        bestDate
      }
    });

  } catch (err) {
    res.json({
      code: 1,
      message: '日期范围查询失败: ' + err.message
    });
  }
});

module.exports = router;
