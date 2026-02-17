const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../config');

let stationsData = null;

function loadStations() {
  if (stationsData) return stationsData;
  
  try {
    const filePath = path.join(__dirname, '../data/stations.json');
    stationsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return stationsData;
  } catch (err) {
    console.error('加载站点数据失败:', err.message);
    return { stations: [], cityStationMap: {}, trainTypes: {} };
  }
}

function getStationByCode(code) {
  const data = loadStations();
  return data.stations.find(s => s.code === code);
}

function getStationsByCity(city) {
  const data = loadStations();
  const codes = data.cityStationMap[city] || [];
  return codes.map(code => data.stations.find(s => s.code === code)).filter(Boolean);
}

function getNearbyStations(lat, lng, radius = 100) {
  const data = loadStations();
  const stations = [];
  
  for (const station of data.stations) {
    const distance = calculateDistance(lat, lng, station.lat, station.lng);
    if (distance <= radius) {
      stations.push({
        ...station,
        distance: Math.round(distance * 10) / 10
      });
    }
  }
  
  return stations.sort((a, b) => a.distance - b.distance);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function getCityCoordinate(city) {
  if (!config.amap.key) {
    return null;
  }
  
  try {
    const response = await axios.get('https://restapi.amap.com/v3/geocode/geo', {
      params: {
        key: config.amap.key,
        city: city,
        address: city
      },
      timeout: 5000
    });
    
    if (response.data.geocodes && response.data.geocodes.length > 0) {
      const [lng, lat] = response.data.geocodes[0].location.split(',');
      return { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
  } catch (err) {
    console.error('获取城市坐标失败:', err.message);
  }
  
  return null;
}

function generateMockTrains(fromStation, toStation, date) {
  const data = loadStations();
  const from = getStationByCode(fromStation);
  const to = getStationByCode(toStation);
  
  if (!from || !to) return [];
  
  const distance = calculateDistance(from.lat, from.lng, to.lat, to.lng);
  const trains = [];
  const trainTypes = ['G', 'D', 'C'];
  const baseHour = 6;
  
  for (let i = 0; i < 8; i++) {
    const type = trainTypes[Math.floor(Math.random() * trainTypes.length)];
    const typeConfig = data.trainTypes[type];
    const duration = Math.ceil(distance / typeConfig.speedKmh * 60);
    const price = Math.round(distance * typeConfig.costPerKm);
    
    const depHour = baseHour + i * 2;
    const depMinute = Math.floor(Math.random() * 60);
    const depTime = `${String(depHour).padStart(2, '0')}:${String(depMinute).padStart(2, '0')}`;
    
    const totalMinutes = depHour * 60 + depMinute + duration;
    const arrHour = Math.floor(totalMinutes / 60) % 24;
    const arrMinute = totalMinutes % 60;
    const arrTime = `${String(arrHour).padStart(2, '0')}:${String(arrMinute).padStart(2, '0')}`;
    
    trains.push({
      trainNo: `${type}${1000 + Math.floor(Math.random() * 9000)}`,
      type,
      typeName: typeConfig.name,
      from: fromStation,
      fromName: from.name,
      to: toStation,
      toName: to.name,
      depTime,
      arrTime,
      duration,
      distance: Math.round(distance),
      price: Math.max(price, 50),
      seats: {
        secondClass: price,
        firstClass: Math.round(price * 1.6),
        businessClass: Math.round(price * 3)
      }
    });
  }
  
  return trains.sort((a, b) => a.depTime.localeCompare(b.depTime));
}

async function searchTrains(fromCity, toCity, date) {
  const fromStations = getStationsByCity(fromCity);
  const toStations = getStationsByCity(toCity);
  
  if (fromStations.length === 0 || toStations.length === 0) {
    return {
      code: 1,
      message: '未找到对应的高铁站',
      trains: []
    };
  }
  
  const allTrains = [];
  
  for (const from of fromStations) {
    for (const to of toStations) {
      const trains = generateMockTrains(from.code, to.code, date);
      allTrains.push(...trains);
    }
  }
  
  allTrains.sort((a, b) => {
    const typeOrder = { 'G': 1, 'D': 2, 'C': 3 };
    if (typeOrder[a.type] !== typeOrder[b.type]) {
      return typeOrder[a.type] - typeOrder[b.type];
    }
    return a.depTime.localeCompare(b.depTime);
  });
  
  return {
    code: 0,
    trains: allTrains.slice(0, 20),
    fromCity,
    toCity,
    date,
    mock: true
  };
}

async function searchNearbyStations(city, radius = 100) {
  const coord = await getCityCoordinate(city);
  
  if (!coord) {
    const cityStations = getStationsByCity(city);
    if (cityStations.length > 0) {
      return {
        code: 0,
        stations: cityStations.map(s => ({ ...s, distance: 0 }))
      };
    }
    return {
      code: 1,
      message: '未找到城市坐标',
      stations: []
    };
  }
  
  const stations = getNearbyStations(coord.lat, coord.lng, radius);
  
  return {
    code: 0,
    stations,
    centerCity: city
  };
}

module.exports = {
  loadStations,
  getStationByCode,
  getStationsByCity,
  getNearbyStations,
  searchTrains,
  searchNearbyStations,
  calculateDistance,
  generateMockTrains
};
