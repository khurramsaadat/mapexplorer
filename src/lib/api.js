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
export async function searchPlaces(query, lang = 'en', userLat = null, userLon = null) {
  if (!query || query.trim().length < 2) return [];

  // Cancel previous request
  if (searchAbortController) searchAbortController.abort();
  searchAbortController = new AbortController();

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      extratags: '1',
      limit: '8',
      'accept-language': lang,
      // Bias results toward Dubai/UAE region so local POI appear first
      viewbox: '54.2,25.7,56.0,24.5',
      bounded: '0', // 0 = prefer viewbox but allow global results too
      countrycodes: 'ae',
    });

    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      signal: searchAbortController.signal,
      headers: { 'User-Agent': 'MapExplorer/1.0' },
    });

    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();

    const results = data.map((item) => {
      let distanceStr = '';
      if (userLat !== null && userLon !== null) {
          const d = calculateDistance(userLat, userLon, parseFloat(item.lat), parseFloat(item.lon));
          distanceStr = d > 1 ? `${d.toFixed(1)} km` : `${Math.round(d * 1000)} m`;
      }

      return {
        id: item.place_id,
        name: item.display_name.split(',')[0],
        fullAddress: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type,
        category: item.category,
        boundingbox: item.boundingbox,
        extratags: item.extratags || {},
        distance: distanceStr
      };
    });
    
    // Fetch wiki details in background (non-blocking) so search results appear instantly
    Promise.all(results.map(async (place) => {
        const wikiTag = place.extratags[`wikipedia:${lang}`] || place.extratags.wikipedia;
        if (wikiTag) {
            place.wikiData = await getWikipediaDetails(wikiTag);
        }
    })).catch(() => {}); // fire-and-forget
    
    return results;
  } catch (err) {
    if (err.name === 'AbortError') return [];
    console.error('Search error:', err);
    return [];
  }
}

/**
 * Fetch details from Wikipedia API given a wikipedia tag (e.g., "en:Dubai International Airport")
 */
export async function getWikipediaDetails(wikiTag) {
  try {
    const parts = wikiTag.split(':');
    if (parts.length < 2) return null;
    const lang = parts[0];
    const title = parts.slice(1).join(':');

    // Wikipedia REST API for page summary
    const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        headers: { 'User-Agent': 'MapExplorer/1.0' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
        title: data.title,
        description: data.extract,
        thumbnail: data.thumbnail?.source || null,
        url: data.content_urls?.desktop?.page || null,
    };
  } catch (err) {
    console.error('Wiki fetch error:', err);
    return null;
  }
}

/**
 * Reverse geocode coordinates to an address
 */
export async function reverseGeocode(lat, lon, lang = 'en') {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      format: 'json',
      addressdetails: '1',
      extratags: '1',
      'accept-language': lang,
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

    const result = {
      name,
      fullAddress: data.display_name,
      lat: parseFloat(data.lat),
      lon: parseFloat(data.lon),
      extratags: data.extratags || {},
    };

    const wikiTag = result.extratags[`wikipedia:${lang}`] || result.extratags.wikipedia;
    if (wikiTag) {
        result.wikiData = await getWikipediaDetails(wikiTag);
    }

    return result;
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
export async function getDirections(startLat, startLon, endLat, endLon, mode = 'driving', numAlternatives = 3) {
    const profiles = {
        driving: 'driving-car',
        walking: 'foot-walking',
        cycling: 'cycling-regular',
    };
    const profile = profiles[mode] || 'driving-car';

    // ORS requires coordinates in [lon, lat] format
    const startCoords = `${startLon},${startLat}`;
    const endCoords = `${endLon},${endLat}`;
    // Using routing.openstreetmap.de which has separate endpoints for car, foot, bike
    // and is generally more reliable for multiple route alternatives
    const host = mode === 'walking' ? 'routed-foot' : mode === 'cycling' ? 'routed-bike' : 'routed-car';
    const osrmUrl = `https://routing.openstreetmap.de/${host}/route/v1/driving/${startCoords};${endCoords}?overview=full&geometries=geojson&steps=true&alternatives=${numAlternatives}`;

    try {
        const response = await fetch(osrmUrl);
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            return data.routes.map(route => {
                const distance =
                    route.distance > 1000
                        ? (route.distance / 1000).toFixed(1) + ' km'
                        : Math.round(route.distance) + ' m';

                const rawDuration = route.duration;
                const durationMinutes = Math.round(rawDuration / 60);
                const duration =
                    durationMinutes > 60
                        ? `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} min`
                        : `${durationMinutes} min`;

                const steps = [];
                if (route.legs && route.legs.length > 0) {
                    route.legs[0].steps.forEach((step) => {
                        const stepDist =
                            step.distance > 1000
                                ? (step.distance / 1000).toFixed(1) + ' km'
                                : Math.round(step.distance) + ' m';

                        let lanes = null;
                        if (step.intersections) {
                            for (const intersection of step.intersections) {
                                if (intersection.lanes && intersection.lanes.length > 0) {
                                    lanes = intersection.lanes.map(l => l.valid);
                                    break; // Take the first meaningful lane instruction for the step
                                }
                            }
                        }

                        // Build English road name: prefer ref (E311) over Arabic name
                        const rawName = step.name || '';
                        const rawRef  = step.ref  || '';
                        const rawDest = step.destinations || '';
                        const englishName = resolveEnglishName(rawName, rawRef, rawDest);

                        steps.push({
                            instruction: buildInstruction(step.maneuver, englishName),
                            distance: stepDist,
                            rawDistance: step.distance || 0,
                            name: englishName,
                            ref: rawRef,
                            destinations: rawDest,
                            lanes: lanes,
                            maneuver: {
                                type: step.maneuver.type || 'continue',
                                modifier: step.maneuver.modifier || null,
                                location: step.maneuver.location,
                            },
                        });
                    });
                }
                
                return {
                    distance,
                    duration,
                    rawDuration,
                    geometry: route.geometry,
                    steps,
                    weight: route.weight || route.duration,
                };
            });
        }
        return null;
    } catch (error) {
        console.error('Error fetching directions:', error);
        return null;
    }
}

/**
 * Calculate Haversine distance between two points in km
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/** Returns true if string contains Arabic characters */
function hasArabic(str) {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str || '');
}

/**
 * Choose the best English road identifier from OSRM step fields.
 * Priority: non-Arabic name → ref (E311) → destinations (first) → empty string
 */
function resolveEnglishName(name, ref, destinations) {
    if (name && !hasArabic(name)) return name;
    if (ref && !hasArabic(ref)) return ref;
    if (destinations) {
        const first = destinations.split(',')[0].split(';')[0].trim();
        if (first && !hasArabic(first)) return first;
    }
    // If all are Arabic, show ref anyway (E311 is always Latin)
    if (ref) return ref;
    return '';
}

/** Build a readable English turn instruction */
function buildInstruction(maneuver, roadName) {
    const type = maneuver.type || 'continue';
    const mod  = maneuver.modifier || '';
    const on   = roadName ? ` on ${roadName}` : '';

    if (type === 'depart')     return `Depart${on}`;
    if (type === 'arrive')     return 'You have arrived at your destination';
    if (type === 'turn')       return `Turn ${mod}${on}`;
    if (type === 'new name')   return `Continue${on}`;
    if (type === 'merge')      return `Merge${mod ? ' ' + mod : ''}${on}`;
    if (type === 'fork')       return `Take the ${mod} fork${on}`;
    if (type === 'roundabout') return `Enter roundabout${on}`;
    if (type === 'rotary')     return `Enter roundabout${on}`;
    if (type === 'end of road')return `Turn ${mod}${on}`;
    if (type === 'use lane')   return `Use the ${mod} lane${on}`;
    if (type === 'continue')   return `Continue${on}`;
    return `${type}${mod ? ' ' + mod : ''}${on}`;
}

function formatInstruction(step) {
    return buildInstruction(step.maneuver, resolveEnglishName(step.name || '', step.ref || '', step.destinations || ''));
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
