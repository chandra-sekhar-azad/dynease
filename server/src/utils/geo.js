/**
 * Geolocation Utilities
 * Haversine distance calculation and proximity verification
 */

/**
 * Calculates geodesic distance in meters between two lat/lng coordinates
 * using the Haversine formula.
 * @param {number|string} lat1 - Latitude of point 1
 * @param {number|string} lon1 - Longitude of point 1
 * @param {number|string} lat2 - Latitude of point 2
 * @param {number|string} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const pLat1 = parseFloat(lat1);
  const pLon1 = parseFloat(lon1);
  const pLat2 = parseFloat(lat2);
  const pLon2 = parseFloat(lon2);

  if (
    isNaN(pLat1) || isNaN(pLon1) || isNaN(pLat2) || isNaN(pLon2) ||
    pLat1 < -90 || pLat1 > 90 || pLat2 < -90 || pLat2 > 90 ||
    pLon1 < -180 || pLon1 > 180 || pLon2 < -180 || pLon2 > 180
  ) {
    throw new Error('Invalid geographic coordinates provided.');
  }

  const R = 6371000; // Earth's mean radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(pLat2 - pLat1);
  const dLon = toRad(pLon2 - pLon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(pLat1)) * Math.cos(toRad(pLat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks whether user coordinates are within maxRadiusMeters of restaurant coordinates.
 * @param {number|string} userLat
 * @param {number|string} userLon
 * @param {number|string} restaurantLat
 * @param {number|string} restaurantLon
 * @param {number} [maxRadiusMeters=50]
 * @returns {{ isWithin: boolean, distanceMeters: number }}
 */
function verifyProximity(userLat, userLon, restaurantLat, restaurantLon, maxRadiusMeters = 50) {
  const distanceMeters = calculateDistanceMeters(userLat, userLon, restaurantLat, restaurantLon);
  return {
    isWithin: distanceMeters <= maxRadiusMeters,
    distanceMeters: Math.round(distanceMeters * 10) / 10
  };
}

module.exports = {
  calculateDistanceMeters,
  verifyProximity
};
