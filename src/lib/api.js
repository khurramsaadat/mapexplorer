/**
 * Geocoding & Routing API utilities using free open-source services.
 * - Search: Nominatim (OpenStreetMap)
 * - Routing: OSRM
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE = 'https://router.project-osrm.org';

let searchAbortController = null;

/**
 * Search for places using Nominatim
 */
export async function searchPlaces(query) {
  if (!query || query.trim().length < 2) return [];

  // Cancel previous request
  if (searchAbortController) searchAbortController.abort();
  searchAbortController = new AbortController();

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '6',
      'accept-language': 'en',
    });

    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      signal: searchAbortController.signal,
      headers: { 'User-Agent': 'MapExplorer/1.0' },
    });

    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();

    return data.map((item) => ({
      id: item.place_id,
      name: item.display_name.split(',')[0],
      fullAddress: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      type: item.type,
      category: item.category,
      boundingbox: item.boundingbox,
    }));
  } catch (err) {
    if (err.name === 'AbortError') return [];
    console.error('Search error:', err);
    return [];
  }
}

/**
 * Reverse geocode coordinates to an address
 */
export async function reverseGeocode(lat, lon) {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      format: 'json',
      addressdetails: '1',
      'accept-language': 'en',
    });

    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: { 'User-Agent': 'MapExplorer/1.0' },
    });

    if (!res.ok) throw new Error('Reverse geocode failed');
    const data = await res.json();

    const addr = data.address || {};
    const name =
      addr.amenity ||
      addr.building ||
      addr.road ||
      addr.neighbourhood ||
      data.display_name.split(',')[0];

    return {
      name,
      fullAddress: data.display_name,
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
    };
  } catch (err) {
    console.error('Reverse geocode error:', err);
    return {
      name: 'Dropped Pin',
      fullAddress: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      lat,
      lon,
    };
  }
}

/**
 * Get routing directions using OSRM
 * @param {string} profile - 'driving' | 'walking' | 'cycling'
 */
export async function getDirections(originLat, originLon, destLat, destLon, profile = 'driving') {
  try {
    // OSRM uses driving/foot/bike
    const osrmProfile =
      profile === 'walking' ? 'foot' : profile === 'cycling' ? 'bike' : 'driving';

    const coords = `${originLon},${originLat};${destLon},${destLat}`;
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'geojson',
      steps: 'true',
    });

    const res = await fetch(
      `${OSRM_BASE}/route/v1/${osrmProfile}/${coords}?${params}`,
      { headers: { 'User-Agent': 'MapExplorer/1.0' } }
    );

    if (!res.ok) throw new Error('Routing failed');
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error('No route found');
    }

    const route = data.routes[0];
    const steps = route.legs[0].steps.map((step) => ({
      instruction: step.maneuver.type === 'depart'
        ? 'Start your trip'
        : step.maneuver.type === 'arrive'
          ? 'You have arrived'
          : formatInstruction(step),
      distance: formatDistance(step.distance),
      duration: formatDuration(step.duration),
      maneuver: step.maneuver,
    }));

    return {
      distance: formatDistance(route.distance),
      duration: formatDuration(route.duration),
      rawDuration: route.duration,
      rawDistance: route.distance,
      geometry: route.geometry,
      steps,
    };
  } catch (err) {
    console.error('Routing error:', err);
    return null;
  }
}

function formatInstruction(step) {
  const modifier = step.maneuver.modifier || '';
  const type = step.maneuver.type;
  const name = step.name || 'unnamed road';

  if (type === 'turn') return `Turn ${modifier} onto ${name}`;
  if (type === 'new name') return `Continue onto ${name}`;
  if (type === 'merge') return `Merge onto ${name}`;
  if (type === 'fork') return `Take the ${modifier} fork onto ${name}`;
  if (type === 'roundabout') return `Enter roundabout, take exit onto ${name}`;
  if (type === 'end of road') return `Turn ${modifier} onto ${name}`;
  return `Continue on ${name}`;
}

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours} hr ${mins} min`;
}
