const express = require('express');
const router = express.Router();
const trainService = require('../services/train');
const interlineService = require('../services/interline');

router.get('/search', async (req, res) => {
  const { from, to, date } = req.query;

  if (!from || !to || !date) {
    return res.json({
      code: 1,
      message: '请提供出发城市、目的地城市和日期'
    });
  }

  try {
    const result = await trainService.searchTrains(from, to, date);
    res.json(result);
  } catch (err) {
    res.json({
      code: 1,
      message: '查询失败: ' + err.message
    });
  }
});

router.get('/nearby', async (req, res) => {
  const { city, radius = 100 } = req.query;

  if (!city) {
    return res.json({
      code: 1,
      message: '请提供城市名称'
    });
  }

  try {
    const result = await trainService.searchNearbyStations(city, parseInt(radius));
    res.json(result);
  } catch (err) {
    res.json({
      code: 1,
      message: '查询失败: ' + err.message
    });
  }
});

router.get('/stations', (req, res) => {
  const { city } = req.query;
  const data = trainService.loadStations();
  
  let stations = data.stations;
  if (city) {
    stations = trainService.getStationsByCity(city);
  }
  
  res.json({
    code: 0,
    data: stations
  });
});

router.post('/interline', async (req, res) => {
  const { originCity, destination, date, radius, maxTrainHours, sortBy } = req.body;

  if (!originCity || !destination || !date) {
    return res.json({
      code: 1,
      message: '请提供出发城市、目的地和日期'
    });
  }

  try {
    const result = await interlineService.searchInterline(
      originCity,
      destination,
      date,
      { radius, maxTrainHours, sortBy }
    );
    res.json(result);
  } catch (err) {
    res.json({
      code: 1,
      message: '联程查询失败: ' + err.message
    });
  }
});

module.exports = router;
