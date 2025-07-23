const axios = require('axios');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function getDistances(userAddress, storeAddresses) {
  if (!GOOGLE_MAPS_API_KEY) throw new Error('Missing GOOGLE_MAPS_API_KEY');
  const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';
  const params = {
    origins: userAddress,
    destinations: storeAddresses.join('|'),
    mode: 'driving',
    key: GOOGLE_MAPS_API_KEY,
  };
  const { data } = await axios.get(url, { params });
  if (data.status !== 'OK') throw new Error('Google Maps API error: ' + data.status);
  const distances = {};
  for (let i = 0; i < storeAddresses.length; i++) {
    const element = data.rows[0].elements[i];
    distances[storeAddresses[i]] = element.status === 'OK' ? element.distance.value / 1000 : null; // in km
  }
  return distances;
}

module.exports = { getDistances }; 