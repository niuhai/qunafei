const R = 6371;

function toRad(deg) {
  return deg * Math.PI / 180;
}

function getDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDistanceFromCity(cityCoord, airportCoord) {
  return getDistance(
    cityCoord.lat, cityCoord.lng,
    airportCoord.lat, airportCoord.lng
  );
}

function findNearbyAirports(lat, lng, airports, radius = 200) {
  return airports
    .filter(a => a.enabled)
    .map(airport => ({
      ...airport,
      distance: Math.round(getDistance(lat, lng, airport.lat, airport.lng) * 10) / 10
    }))
    .filter(airport => airport.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}

function estimateTransport(distance, transportConfig) {
  if (distance === 0) {
    return { type: 'local', time: 0, cost: 0 };
  }

  const trainTime = Math.round(distance / transportConfig.train.speedKmPerHour * 60);
  const trainCost = Math.round(distance * transportConfig.train.costPerKm);
  
  const carTime = Math.round(distance / transportConfig.car.speedKmPerHour * 60);
  const carCost = Math.round(distance * transportConfig.car.costPerKm);

  if (trainTime <= carTime && trainCost <= carCost) {
    return { type: 'train', time: trainTime, cost: trainCost };
  }
  
  return { type: 'car', time: carTime, cost: carCost };
}

module.exports = {
  getDistance,
  getDistanceFromCity,
  findNearbyAirports,
  estimateTransport
};
