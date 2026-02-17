const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

const airportRoutes = require('./routes/airport');
const flightRoutes = require('./routes/flight');
const calculateRoutes = require('./routes/calculate');
const routeRoutes = require('./routes/route');
const trainRoutes = require('./routes/train');

app.use('/api/airports', airportRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/calculate', calculateRoutes);
app.use('/api/route', routeRoutes);
app.use('/api/train', trainRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    code: 0,
    message: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      amapEnabled: !!config.amap.key,
      variflightEnabled: !!(config.variflight && config.variflight.key),
      port: config.server.port
    }
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    code: 0,
    data: {
      defaultRadius: config.search.defaultRadius,
      maxRadius: config.search.maxRadius,
      defaultSortBy: config.search.defaultSortBy,
      cacheExpireMinutes: config.cache.expireMinutes,
      transport: config.transport
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    code: 1,
    message: '服务器内部错误'
  });
});

const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`🛫 航班价格周边机场筛选服务已启动`);
  console.log(`📍 本地访问: http://localhost:${PORT}`);
  console.log(`📍 API文档: http://localhost:${PORT}/api/health`);
  console.log(`📍 高德地图: ${config.amap.key ? '已配置' : '未配置（使用估算模式）'}`);
  console.log(`📍 飞常准API: ${config.variflight && config.variflight.key ? '已配置' : '未配置（使用模拟数据）'}`);
});

module.exports = app;
