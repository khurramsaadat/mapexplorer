/** Map tile layer / style configurations for MapLibre GL JS */

// OpenFreeMap styles – completely free, no API key needed, English labels
export const mapStyles = {
  streets: {
    url: 'https://tiles.openfreemap.org/styles/liberty',
    name: 'Streets',
  },
  satellite: {
    // Esri World Imagery as raster source inside a MapLibre style
    url: null, // handled as custom raster source in MapView
    name: 'Satellite',
  },
};

export const defaultCenter = [55.2708, 25.2048]; // [lng, lat] – Dubai (MapLibre uses lng,lat)
export const defaultZoom = 12;
