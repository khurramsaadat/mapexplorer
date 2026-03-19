'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { mapStyles, defaultCenter, defaultZoom } from '@/lib/tiles';
import { reverseGeocode } from '@/lib/api';

const applyStyleTweaks = (map, isDarkMode) => {
    try {
        const style = map.getStyle();
        if (style && style.layers) {
            style.layers.forEach((layer) => {
                // Force English labels
                if (layer.layout && layer.layout['text-field']) {
                    map.setLayoutProperty(layer.id, 'text-field', [
                        'coalesce',
                        ['get', 'name:en'],
                        ['get', 'name_en'],
                        ['get', 'name:latin'],
                        ['get', 'name'],
                    ]);
                }

                // Expose more POIs at lower zooms by reducing minzoom by 2 levels (min 0)
                if (layer.id.includes('poi') || (layer['source-layer'] && layer['source-layer'].includes('poi'))) {
                    if (layer.minzoom !== undefined) {
                        map.setLayerZoomRange(layer.id, Math.max(0, layer.minzoom - 2), layer.maxzoom || 24);
                    }
                }

                // Fix dark mode white text halos to improve contrast and readability
                if (isDarkMode) {
                    if (layer.paint && (layer.paint['text-halo-color'] !== undefined || layer.paint['text-halo-width'] !== undefined)) {
                        map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(0,0,0,0)');
                        map.setPaintProperty(layer.id, 'text-halo-width', 0);
                    }
                }
            });
        }
    } catch (e) {
        console.warn('Could not apply map style tweaks', e);
    }
};

const MapView = forwardRef(function MapView({ onMapClick, currentLayer, lang, isDark }, ref) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const routeLayerRef = useRef(false);
    const locationMarkerRef = useRef(null);
    const locationCircleRef = useRef(null);
    const langRef = useRef(lang);

    useEffect(() => {
        langRef.current = lang;
    }, [lang]);

    // Initialize map
    useEffect(() => {
        if (mapRef.current) return;

        // Restore state from localStorage
        const savedLng = parseFloat(localStorage.getItem('map_lng')) || defaultCenter[0];
        const savedLat = parseFloat(localStorage.getItem('map_lat')) || defaultCenter[1];
        const savedZoom = parseInt(localStorage.getItem('map_zoom')) || defaultZoom;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: mapStyles.streets.url,
            center: [savedLng, savedLat],
            zoom: savedZoom,
            attributionControl: true,
        });

        // Save state on move
        map.on('moveend', () => {
            const center = map.getCenter();
            localStorage.setItem('map_lat', center.lat.toString());
            localStorage.setItem('map_lng', center.lng.toString());
            localStorage.setItem('map_zoom', Math.round(map.getZoom()).toString());
        });

        // Click to explore
        map.on('click', async (e) => {
            const { lat, lng } = e.lngLat;
            const place = await reverseGeocode(lat, lng, langRef.current);
            onMapClick?.(place);
        });

        map.on('load', () => {
            applyStyleTweaks(map, isDark);
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Change style/layer
    useEffect(() => {
        if (!mapRef.current || !currentLayer) return;
        const map = mapRef.current;

        if (currentLayer === 'satellite') {
            // Custom raster style for satellite imagery
            const satelliteStyle = {
                version: 8,
                sources: {
                    'esri-satellite': {
                        type: 'raster',
                        tiles: [
                            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                        ],
                        tileSize: 256,
                        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
                        maxzoom: 19,
                    },
                },
                layers: [
                    {
                        id: 'esri-satellite-layer',
                        type: 'raster',
                        source: 'esri-satellite',
                        minzoom: 0,
                        maxzoom: 19,
                    },
                ],
            };
            map.setStyle(satelliteStyle);
        } else {
            const styleConfig = mapStyles[currentLayer];
            if (styleConfig?.url) {
                map.setStyle(styleConfig.url);
                // Re-apply style tweaks after style loads
                map.once('styledata', () => {
                    setTimeout(() => {
                        applyStyleTweaks(map, currentLayer === 'dark' || isDark);
                    }, 500);
                });
            }
        }
    }, [currentLayer]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        flyTo(lat, lon, zoom = 16) {
            mapRef.current?.flyTo({ center: [lon, lat], zoom, duration: 1500 });
        },

        addMarker(lat, lon, popupText, iconColor = 'default') {
            if (!mapRef.current) return;
            const colorMap = { blue: '#4285f4', red: '#ea4335', green: '#34a853', default: '#5f6368' };
            const color = colorMap[iconColor] || colorMap.default;

            const marker = new maplibregl.Marker({ color })
                .setLngLat([lon, lat])
                .addTo(mapRef.current);

            if (popupText) {
                const popup = new maplibregl.Popup({ offset: 25 }).setHTML(popupText);
                marker.setPopup(popup);
            }
            markersRef.current.push(marker);
            return marker;
        },

        clearMarkers() {
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];
        },

        drawRoutes(routes, activeIndex = 0, originCoords, destCoords) {
            if (!mapRef.current || !routes || routes.length === 0) return;
            const map = mapRef.current;

            // Clear previous
            this.clearRoute();

            // Wait for style to be loaded
            const addRouteLayers = () => {
                // Draw inactive routes first so they are under the active one
                routes.forEach((route, index) => {
                    const isActive = index === activeIndex;
                    const sourceId = `route-${index}`;
                    const outlineId = `route-outline-${index}`;
                    const lineId = `route-line-${index}`;

                    map.addSource(sourceId, {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            properties: {},
                            geometry: route.geometry,
                        },
                    });

                    // Outline
                    map.addLayer({
                        id: outlineId,
                        type: 'line',
                        source: sourceId,
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: { 'line-color': isActive ? '#ffffff' : '#aaaaaa', 'line-width': isActive ? 10 : 6, 'line-opacity': 0.9 },
                    });

                    // Main route
                    map.addLayer({
                        id: lineId,
                        type: 'line',
                        source: sourceId,
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: { 'line-color': isActive ? '#4285f4' : '#888888', 'line-width': isActive ? 6 : 4, 'line-opacity': isActive ? 1 : 0.6 },
                    });
                });

                routeLayerRef.current = { count: routes.length };

                // Add origin & destination markers based on the active route
                if (originCoords) {
                    this.addMarker(originCoords.lat, originCoords.lon, 'Origin', 'green');
                }
                if (destCoords) {
                    this.addMarker(destCoords.lat, destCoords.lon, 'Destination', 'red');
                }

                // Fit bounds to the active route
                const coords = routes[activeIndex].geometry.coordinates;
                const bounds = coords.reduce(
                    (b, coord) => b.extend(coord),
                    new maplibregl.LngLatBounds(coords[0], coords[0])
                );
                map.fitBounds(bounds, { padding: 60, duration: 1000 });
            };

            if (map.isStyleLoaded()) {
                addRouteLayers();
            } else {
                map.once('load', addRouteLayers);
            }
        },

        clearRoute() {
            if (mapRef.current && routeLayerRef.current) {
                try {
                    const count = routeLayerRef.current.count || 3;
                    for (let i = 0; i < count; i++) {
                        if (mapRef.current.getLayer(`route-line-${i}`)) mapRef.current.removeLayer(`route-line-${i}`);
                        if (mapRef.current.getLayer(`route-outline-${i}`)) mapRef.current.removeLayer(`route-outline-${i}`);
                        if (mapRef.current.getSource(`route-${i}`)) mapRef.current.removeSource(`route-${i}`);
                    }
                } catch (e) {
                    // Layers may not exist
                }
                routeLayerRef.current = false;
            }
            this.clearMarkers();
        },

        locateUser() {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude: lat, longitude: lng } = pos.coords;
                    const accuracy = pos.coords.accuracy;
                    const map = mapRef.current;
                    if (!map) return;

                    map.flyTo({ center: [lng, lat], zoom: 16, duration: 1500 });

                    // Remove old location markers
                    if (locationMarkerRef.current) locationMarkerRef.current.remove();
                    if (locationCircleRef.current) {
                        try {
                            if (map.getLayer('location-circle')) map.removeLayer('location-circle');
                            if (map.getSource('location-circle')) map.removeSource('location-circle');
                        } catch (e) { /* ignore */ }
                    }

                    // Add accuracy circle as a GeoJSON source
                    const addLocationMarkers = () => {
                        try {
                            map.addSource('location-circle', {
                                type: 'geojson',
                                data: {
                                    type: 'Feature',
                                    geometry: { type: 'Point', coordinates: [lng, lat] },
                                    properties: {},
                                },
                            });
                            map.addLayer({
                                id: 'location-circle',
                                type: 'circle',
                                source: 'location-circle',
                                paint: {
                                    'circle-radius': Math.min(accuracy / 2, 50),
                                    'circle-color': '#4285f4',
                                    'circle-opacity': 0.1,
                                    'circle-stroke-width': 1,
                                    'circle-stroke-color': '#4285f4',
                                },
                            });
                            locationCircleRef.current = true;
                        } catch (e) { /* ignore */ }
                    };

                    if (map.isStyleLoaded()) {
                        addLocationMarkers();
                    } else {
                        map.once('load', addLocationMarkers);
                    }

                    // Location dot (pulsing via CSS)
                    const el = document.createElement('div');
                    el.className = 'location-pulse-container';
                    el.innerHTML = '<div class="location-pulse"></div>';
                    locationMarkerRef.current = new maplibregl.Marker({ element: el })
                        .setLngLat([lng, lat])
                        .addTo(map);
                },
                (err) => {
                    console.warn('Location access denied or timed out:', err.message);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        },

        zoomIn() {
            mapRef.current?.zoomIn();
        },

        zoomOut() {
            mapRef.current?.zoomOut();
        },

        getMap() {
            return mapRef.current;
        },
    }));

    return (
        <div className={`map-wrapper layer-${currentLayer} ${isDark ? 'theme-dark' : 'theme-light'}`}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
});

export default MapView;
