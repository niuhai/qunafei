const helpers = require('../utils/helpers');
const geo = require('../utils/geo');
const config = require('../config');

function calculateTotalCost(flight, transport) {
  const ticketPrice = flight.price;
  const transportCost = transport.cost;
  const timeValue = transport.time * 0.5;

  return {
    ticket: ticketPrice,
    transport: transportCost,
    timeValue: Math.round(timeValue),
    total: ticketPrice + transportCost + Math.round(timeValue)
  };
}

function sortRecommendations(results, preference = config.search.defaultSortBy) {
  return results.sort((a, b) => {
    if (preference === 'totalCost') {
      return a.totalCost.total - b.totalCost.total;
    } else if (preference === 'totalTime') {
      return a.totalTime - b.totalTime;
    } else if (preference === 'ticketPrice') {
      return a.flight.price - b.flight.price;
    } else if (preference === 'savings') {
      return b.savings - a.savings;
    }
    return 0;
  });
}

function getFlightDuration(flight) {
  if (!flight.depTime || !flight.arrTime) return 120;
  
  const [depH, depM] = flight.depTime.split(':').map(Number);
  const [arrH, arrM] = flight.arrTime.split(':').map(Number);
  
  let duration = (arrH * 60 + arrM) - (depH * 60 + depM);
  if (duration < 0) duration += 24 * 60;
  
  return duration;
}

function generateMockFlightsForAirport(fromCode, toCode) {
  const airlines = [
    { name: '中国国航', prefix: 'CA' },
    { name: '东方航空', prefix: 'MU' },
    { name: '南方航空', prefix: 'CZ' },
    { name: '海南航空', prefix: 'HU' },
    { name: '山东航空', prefix: 'SC' },
    { name: '厦门航空', prefix: 'MF' }
  ];

  const flights = [];
  const numFlights = Math.floor(Math.random() * 4) + 2;
  const basePrice = Math.floor(Math.random() * 400) + 400;

  for (let i = 0; i < numFlights; i++) {
    const airline = airlines[Math.floor(Math.random() * airlines.length)];
    const flightNo = `${airline.prefix}${Math.floor(Math.random() * 9000) + 1000}`;
    const depHour = Math.floor(Math.random() * 12) + 6;
    const depMin = Math.floor(Math.random() * 60);
    const duration = Math.floor(Math.random() * 120) + 60;
    const arrHour = depHour + Math.floor(duration / 60);
    const arrMin = (depMin + duration % 60) % 60;
    const price = basePrice + Math.floor(Math.random() * 300);

    flights.push({
      flightNo,
      airline: airline.name,
      from: fromCode,
      to: toCode,
      depTime: `${String(depHour).padStart(2, '0')}:${String(depMin).padStart(2, '0')}`,
      arrTime: `${String(arrHour).padStart(2, '0')}:${String(arrMin).padStart(2, '0')}`,
      price,
      isDirect: Math.random() > 0.2
    });
  }

  return flights.sort((a, b) => a.price - b.price);
}

function compareRecommendations(recommendations) {
  if (recommendations.length < 2) return recommendations;
  
  const sorted = [...recommendations].sort((a, b) => a.totalCost.total - b.totalCost.total);
  const cheapest = sorted[0];
  const mostExpensive = sorted[sorted.length - 1];
  
  return recommendations.map(r => ({
    ...r,
    comparison: {
      isCheapest: r.airport.code === cheapest.airport.code,
      isMostExpensive: r.airport.code === mostExpensive.airport.code,
      priceDiff: r.totalCost.total - cheapest.totalCost.total,
      timeDiff: r.totalTime - recommendations.reduce((min, item) => 
        item.totalTime < min ? item.totalTime : min, Infinity)
    }
  }));
}

module.exports = {
  calculateTotalCost,
  sortRecommendations,
  getFlightDuration,
  generateMockFlightsForAirport,
  compareRecommendations
};
