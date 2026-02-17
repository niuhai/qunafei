const distanceService = require('./distance');
const crawlerService = require('./crawler');
const variflightService = require('./variflight');
const recommendService = require('./recommend');
const config = require('../config');
const helpers = require('../utils/helpers');

const TIME_COST_PER_MINUTE = 0.5;
const TRANSFER_COST_PER_MINUTE = 0.3;
const MAX_TRANSFER_TIME = 180;

async function findOptimalRoute(originCity, destinationCity, date, options = {}) {
  const radius = options.radius || config.search.defaultRadius;
  const maxStops = options.maxStops || 1;
  const sortBy = options.sortBy || 'totalCost';
  const dataSource = options.dataSource || 'variflight';

  console.log(`Finding optimal route: ${originCity} -> ${destinationCity} on ${date}`);

  const originAirports = await distanceService.getNearbyAirports(originCity, radius);
  if (originAirports.error || originAirports.airports.length === 0) {
    return { error: '出发地周边无可用机场', code: 'NO_ORIGIN_AIRPORT' };
  }

  const destAirports = await distanceService.getNearbyAirports(destinationCity, radius);
  if (destAirports.error || destAirports.airports.length === 0) {
    return { error: '目的地周边无可用机场', code: 'NO_DEST_AIRPORT' };
  }

  const originAirportCodes = originAirports.airports.map(a => a.code);
  const destAirportCodes = destAirports.airports.map(a => a.code);

  const allRoutes = [];

  const directRoutes = await findDirectRoutes(
    originAirports.airports,
    destAirportCodes,
    date,
    dataSource
  );
  allRoutes.push(...directRoutes);

  if (maxStops >= 1) {
    const oneStopRoutes = await findOneStopRoutes(
      originAirports.airports,
      destAirportCodes,
      date,
      radius,
      dataSource
    );
    allRoutes.push(...oneStopRoutes);
  }

  const sortedRoutes = sortRoutes(allRoutes, sortBy);

  const baseline = findBaseline(sortedRoutes, originCity);

  if (baseline) {
    sortedRoutes.forEach(route => {
      route.savings = baseline.totalCost.total - route.totalCost.total;
    });
  }

  return {
    originCity,
    destinationCity,
    date,
    radius,
    routes: sortedRoutes,
    baseline: baseline ? {
      airport: baseline.departureAirport.code,
      price: baseline.flight.price
    } : null,
    searchStats: {
      directRoutesFound: directRoutes.length,
      oneStopRoutesFound: allRoutes.length - directRoutes.length,
      totalRoutesFound: allRoutes.length
    }
  };
}

async function findDirectRoutes(originAirports, destAirportCodes, date, dataSource) {
  const routes = [];
  const searchService = dataSource === 'variflight' ? variflightService : crawlerService;

  for (const originAirport of originAirports) {
    const flightResults = await searchService.searchMultiAirportFlights(
      [originAirport.code],
      destAirportCodes,
      date
    );

    for (const result of flightResults) {
      if (result.flights.length === 0) continue;

      const destAirport = await getDestAirportInfo(result.toCode);
      if (!destAirport) continue;

      for (const flight of result.flights) {
        const totalCost = calculateRouteCost(
          [{ flight, departureAirport: originAirport, arrivalAirport: destAirport }],
          originAirport.transport
        );

        routes.push({
          type: 'direct',
          segments: [{
            flight,
            departureAirport: {
              code: originAirport.code,
              name: originAirport.name,
              city: originAirport.city,
              distance: originAirport.distance
            },
            arrivalAirport: {
              code: destAirport.code,
              name: destAirport.name,
              city: destAirport.city
            }
          }],
          departureAirport: {
            code: originAirport.code,
            name: originAirport.name,
            city: originAirport.city,
            distance: originAirport.distance
          },
          arrivalAirport: {
            code: destAirport.code,
            name: destAirport.name,
            city: destAirport.city
          },
          flight,
          groundTransport: originAirport.transport,
          totalCost,
          totalTime: originAirport.transport.time + getFlightDuration(flight),
          savings: 0
        });
      }
    }
  }

  return routes;
}

async function findOneStopRoutes(originAirports, destAirportCodes, date, radius, dataSource) {
  const routes = [];
  const searchService = dataSource === 'variflight' ? variflightService : crawlerService;

  const allAirports = helpers.getAirports();
  const potentialStops = allAirports.filter(a => 
    a.enabled && 
    !originAirports.some(o => o.code === a.code) &&
    !destAirportCodes.includes(a.code)
  );

  console.log(`Checking ${potentialStops.length} potential stop airports...`);

  for (const originAirport of originAirports) {
    for (const stopAirport of potentialStops.slice(0, 20)) {
      const firstLegResults = await searchService.searchFlights(
        originAirport.code,
        stopAirport.code,
        date
      );

      if (!firstLegResults.flights || firstLegResults.flights.length === 0) continue;

      const secondLegResults = await searchService.searchMultiAirportFlights(
        [stopAirport.code],
        destAirportCodes,
        date
      );

      for (const secondLeg of secondLegResults) {
        if (!secondLeg.flights || secondLeg.flights.length === 0) continue;

        const destAirport = await getDestAirportInfo(secondLeg.toCode);
        if (!destAirport) continue;

        for (const firstFlight of firstLegResults.flights.slice(0, 3)) {
          for (const secondFlight of secondLeg.flights.slice(0, 3)) {
            const transferTime = calculateTransferTime(firstFlight, secondFlight);
            
            if (transferTime < 30 || transferTime > MAX_TRANSFER_TIME) continue;

            const totalCost = calculateRouteCost(
              [
                { flight: firstFlight, departureAirport: originAirport, arrivalAirport: stopAirport },
                { flight: secondFlight, departureAirport: stopAirport, arrivalAirport: destAirport }
              ],
              originAirport.transport,
              transferTime
            );

            const totalTime = originAirport.transport.time + 
              getFlightDuration(firstFlight) + 
              transferTime + 
              getFlightDuration(secondFlight);

            routes.push({
              type: 'oneStop',
              segments: [
                {
                  flight: firstFlight,
                  departureAirport: {
                    code: originAirport.code,
                    name: originAirport.name,
                    city: originAirport.city,
                    distance: originAirport.distance
                  },
                  arrivalAirport: {
                    code: stopAirport.code,
                    name: stopAirport.name,
                    city: stopAirport.city
                  }
                },
                {
                  flight: secondFlight,
                  departureAirport: {
                    code: stopAirport.code,
                    name: stopAirport.name,
                    city: stopAirport.city
                  },
                  arrivalAirport: {
                    code: destAirport.code,
                    name: destAirport.name,
                    city: destAirport.city
                  },
                  transferTime
                }
              ],
              departureAirport: {
                code: originAirport.code,
                name: originAirport.name,
                city: originAirport.city,
                distance: originAirport.distance
              },
              arrivalAirport: {
                code: destAirport.code,
                name: destAirport.name,
                city: destAirport.city
              },
              stopAirport: {
                code: stopAirport.code,
                name: stopAirport.name,
                city: stopAirport.city
              },
              groundTransport: originAirport.transport,
              totalCost,
              totalTime,
              savings: 0
            });
          }
        }
      }
    }
  }

  return routes;
}

function calculateRouteCost(segments, groundTransport, transferTime = 0) {
  let ticketPrice = 0;
  let totalTime = groundTransport ? groundTransport.time : 0;

  for (const segment of segments) {
    ticketPrice += segment.flight.price;
    totalTime += getFlightDuration(segment.flight);
  }

  totalTime += transferTime;

  const transportCost = groundTransport ? groundTransport.cost : 0;
  const timeValue = Math.round(totalTime * TIME_COST_PER_MINUTE);
  const transferCost = Math.round(transferTime * TRANSFER_COST_PER_MINUTE);

  return {
    ticket: ticketPrice,
    transport: transportCost,
    timeValue,
    transferCost,
    total: ticketPrice + transportCost + timeValue + transferCost
  };
}

function calculateTransferTime(firstFlight, secondFlight) {
  if (!firstFlight.arrTime || !secondFlight.depTime) return 120;

  const [arrH, arrM] = firstFlight.arrTime.split(':').map(Number);
  const [depH, depM] = secondFlight.depTime.split(':').map(Number);

  let transferMinutes = (depH * 60 + depM) - (arrH * 60 + arrM);
  if (transferMinutes < 0) transferMinutes += 24 * 60;

  return transferMinutes;
}

function getFlightDuration(flight) {
  if (!flight.depTime || !flight.arrTime) return 120;

  const [depH, depM] = flight.depTime.split(':').map(Number);
  const [arrH, arrM] = flight.arrTime.split(':').map(Number);

  let duration = (arrH * 60 + arrM) - (depH * 60 + depM);
  if (duration < 0) duration += 24 * 60;

  return duration;
}

function sortRoutes(routes, preference) {
  return routes.sort((a, b) => {
    switch (preference) {
      case 'totalCost':
        return a.totalCost.total - b.totalCost.total;
      case 'totalTime':
        return a.totalTime - b.totalTime;
      case 'ticketPrice':
        return a.totalCost.ticket - b.totalCost.ticket;
      default:
        return a.totalCost.total - b.totalCost.total;
    }
  });
}

function findBaseline(routes, originCity) {
  return routes.find(r => 
    r.type === 'direct' && 
    r.departureAirport.city === originCity
  ) || (routes.length > 0 ? routes[0] : null);
}

async function getDestAirportInfo(code) {
  const airport = helpers.getAirportByCode(code);
  if (!airport) return null;
  return {
    code: airport.code,
    name: airport.name,
    city: airport.city
  };
}

async function compareRoutes(originCity, destinationCity, date, options = {}) {
  const result = await findOptimalRoute(originCity, destinationCity, date, options);
  
  if (result.error) {
    return result;
  }

  const comparison = {
    best: result.routes[0] || null,
    cheapest: result.routes.sort((a, b) => a.totalCost.ticket - b.totalCost.ticket)[0] || null,
    fastest: result.routes.sort((a, b) => a.totalTime - b.totalTime)[0] || null,
    directOnly: result.routes.filter(r => r.type === 'direct').sort((a, b) => a.totalCost.total - b.totalCost.total)[0] || null
  };

  return {
    ...result,
    comparison
  };
}

module.exports = {
  findOptimalRoute,
  findOneStopRoutes,
  compareRoutes,
  calculateRouteCost,
  calculateTransferTime,
  getFlightDuration
};
