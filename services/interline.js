const trainService = require('./train');
const crawlerService = require('./crawler');
const distanceService = require('./distance');

async function searchInterline(originCity, destination, date, options = {}) {
  const {
    radius = 200,
    maxTrainHours = 3,
    minTransferMinutes = 60,
    maxTransferMinutes = 240,
    sortBy = 'totalCost'
  } = options;

  const results = {
    direct: [],
    trainThenFlight: [],
    flightThenTrain: [],
    best: null
  };

  const originAirports = await distanceService.getNearbyAirports(originCity, radius);
  if (originAirports.length === 0) {
    return { code: 1, message: '未找到出发地周边机场', results };
  }

  const originStations = await trainService.searchNearbyStations(originCity, radius);
  const originTrainStations = originStations.stations || [];

  const directFlights = await searchDirectFlights(originAirports, destination, date);
  results.direct = directFlights;

  const trainFlightOptions = await searchTrainThenFlight(
    originTrainStations, 
    destination, 
    date,
    { maxTrainHours, minTransferMinutes, maxTransferMinutes }
  );
  results.trainThenFlight = trainFlightOptions;

  const flightTrainOptions = await searchFlightThenTrain(
    originAirports,
    destination,
    date,
    { minTransferMinutes, maxTransferMinutes }
  );
  results.flightThenTrain = flightTrainOptions;

  const allOptions = [
    ...results.direct.map(f => ({ ...f, type: 'direct' })),
    ...results.trainThenFlight.map(f => ({ ...f, type: 'trainThenFlight' })),
    ...results.flightThenTrain.map(f => ({ ...f, type: 'flightThenTrain' }))
  ];

  if (allOptions.length > 0) {
    allOptions.sort((a, b) => {
      if (sortBy === 'totalCost') return a.totalCost - b.totalCost;
      if (sortBy === 'totalTime') return a.totalTime - b.totalTime;
      return 0;
    });
    results.best = allOptions[0];
  }

  return {
    code: 0,
    results,
    originCity,
    destination,
    date,
    searchStats: {
      directCount: results.direct.length,
      trainFlightCount: results.trainThenFlight.length,
      flightTrainCount: results.flightThenTrain.length
    }
  };
}

async function searchDirectFlights(airports, destination, date) {
  const results = [];
  
  for (const airport of airports) {
    const flightData = await crawlerService.searchFlights(airport.code, destination, date);
    
    if (flightData.flights) {
      for (const flight of flightData.flights) {
        results.push({
          type: 'direct',
          departureAirport: airport,
          flight,
          transport: { type: 'local', time: 0, cost: 0 },
          totalCost: flight.price,
          totalTime: getFlightDuration(flight),
          savings: 0
        });
      }
    }
  }
  
  return results.sort((a, b) => a.totalCost - b.totalCost).slice(0, 10);
}

async function searchTrainThenFlight(trainStations, destination, date, options) {
  const { maxTrainHours, minTransferMinutes, maxTransferMinutes } = options;
  const results = [];

  const destAirports = await distanceService.getNearbyAirports(destination, 200);
  const destCities = [...new Set(destAirports.map(a => a.city))];

  for (const station of trainStations.slice(0, 3)) {
    for (const destCity of destCities) {
      const trainData = await trainService.searchTrains(station.city, destCity, date);
      
      if (trainData.trains) {
        for (const train of trainData.trains) {
          if (train.duration > maxTrainHours * 60) continue;

          const nearbyAirports = await distanceService.getNearbyAirports(destCity, 100);
          
          for (const airport of nearbyAirports.slice(0, 2)) {
            const flightData = await crawlerService.searchFlights(airport.code, destination, date);
            
            if (flightData.flights) {
              for (const flight of flightData.flights) {
                const transferMinutes = calculateTransferTime(train.arrTime, flight.depTime);
                
                if (transferMinutes < minTransferMinutes || transferMinutes > maxTransferMinutes) {
                  continue;
                }

                const totalCost = train.price + flight.price;
                const totalTime = train.duration + transferMinutes + getFlightDuration(flight);
                
                results.push({
                  type: 'trainThenFlight',
                  train: {
                    ...train,
                    departureStation: station
                  },
                  transfer: {
                    city: destCity,
                    minutes: transferMinutes
                  },
                  flight,
                  totalCost,
                  totalTime
                });
              }
            }
          }
        }
      }
    }
  }

  return results.sort((a, b) => a.totalCost - b.totalCost).slice(0, 10);
}

async function searchFlightThenTrain(airports, destination, date, options) {
  const { minTransferMinutes, maxTransferMinutes } = options;
  const results = [];

  const destStations = await trainService.searchNearbyStations(destination, 200);
  const destTrainStations = destStations.stations || [];

  if (destTrainStations.length === 0) {
    return results;
  }

  const destCities = [...new Set(destTrainStations.map(s => s.city))];

  for (const airport of airports.slice(0, 3)) {
    for (const destCity of destCities) {
      const flightData = await crawlerService.searchFlights(airport.code, destCity, date);
      
      if (flightData.flights) {
        for (const flight of flightData.flights) {
          const trainData = await trainService.searchTrains(destCity, destination, date);
          
          if (trainData.trains) {
            for (const train of trainData.trains) {
              const transferMinutes = calculateTransferTime(flight.arrTime, train.depTime);
              
              if (transferMinutes < minTransferMinutes || transferMinutes > maxTransferMinutes) {
                continue;
              }

              const totalCost = flight.price + train.price;
              const totalTime = getFlightDuration(flight) + transferMinutes + train.duration;
              
              results.push({
                type: 'flightThenTrain',
                flight,
                transfer: {
                  city: destCity,
                  minutes: transferMinutes
                },
                train: {
                  ...train,
                  arrivalStation: destTrainStations.find(s => s.city === destination)
                },
                totalCost,
                totalTime
              });
            }
          }
        }
      }
    }
  }

  return results.sort((a, b) => a.totalCost - b.totalCost).slice(0, 10);
}

function getFlightDuration(flight) {
  const [depH, depM] = flight.depTime.split(':').map(Number);
  const [arrH, arrM] = flight.arrTime.split(':').map(Number);
  
  let duration = (arrH * 60 + arrM) - (depH * 60 + depM);
  if (duration < 0) duration += 24 * 60;
  
  return duration;
}

function calculateTransferTime(arrTime, depTime) {
  const [arrH, arrM] = arrTime.split(':').map(Number);
  const [depH, depM] = depTime.split(':').map(Number);
  
  let minutes = (depH * 60 + depM) - (arrH * 60 + arrM);
  if (minutes < 0) minutes += 24 * 60;
  
  return minutes;
}

module.exports = {
  searchInterline,
  searchDirectFlights,
  searchTrainThenFlight,
  searchFlightThenTrain
};
