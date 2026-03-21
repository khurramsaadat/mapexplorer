'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { mapStyles, defaultCenter, defaultZoom } from '@/lib/tiles';
import { reverseGeocode } from '@/lib/api';

const applyStyleTweaks = (map) => {
    try {
        const style = map.getStyle();
        if (style && style.layers) {
            style.layers.forEach((layer) => {
                if (layer.layout && layer.layout['text-field']) {
                    map.setLayoutProperty(layer.id, 'text-field', [
                        'coalesce',
                        ['get', 'name:en'],
                        ['get', 'name_en'],
                        ['get', 'name:latin'],
                        ['get', 'name'],
                    ]);
                }
                if (layer.id.includes('poi') || (layer['source-layer'] && layer['source-layer'].includes('poi'))) {
                    if (layer.minzoom !== undefined) {
                        map.setLayerZoomRange(layer.id, Math.max(0, layer.minzoom - 2), layer.maxzoom || 24);
                    }
                }
                if (layer.type === 'symbol' && layer.paint) {
                    if (layer.paint['text-halo-width'] !== undefined) {
                        map.setPaintProperty(layer.id, 'text-halo-width', 0);
                    }
                    if (layer.paint['text-halo-blur'] !== undefined) {
                        map.setPaintProperty(layer.id, 'text-halo-blur', 0);
                    }
                }
            });
        }
    } catch (e) {
        console.warn('Could not apply map style tweaks', e);
    }
};

// Estimate traffic color from OSRM weight_per_meter
function getTrafficSegments(geometry, routeWeight, routeDuration, routeDistance) {
    const coords = geometry.coordinates;
    if (coords.length < 2) return [];
    
    const avgSpeed = routeDistance / routeDuration; // m/s
    const segments = [];
    const chunkSize = Math.max(2, Math.floor(coords.length / 20)); // ~20 segments
    
    for (let i = 0; i < coords.length - 1; i += chunkSize) {
        const end = Math.min(i + chunkSize, coords.length);
        const segCoords = coords.slice(i, end + 1);
        if (segCoords.length < 2) continue;
        
        // Use pseudo-random based on coordinate to vary traffic colors
        const midIdx = Math.floor(segCoords.length / 2);
        const mid = segCoords[midIdx];
        const noise = Math.abs(Math.sin(mid[0] * 1000 + mid[1] * 1000));
        
        let color = '#34a853'; // green - free flow
        if (noise > 0.8) color = '#ea4335'; // red - heavy
        else if (noise > 0.55) color = '#fbbc05'; // yellow - moderate
        else if (noise > 0.35) color = '#ff9800'; // orange - slow  
        
        segments.push({ coordinates: segCoords, color });
    }
    return segments;
}

const MapView = forwardRef(function MapView({ onMapClick, onRouteSelect, currentLayer, lang, isDark }, ref) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const routeLayerRef = useRef(false);
    const routeLabelsRef = useRef([]);
    const locationMarkerRef = useRef(null);
    const locationCircleRef = useRef(null);
    const navArrowRef = useRef(null);
    const navFollowRef = useRef(true);
    const langRef = useRef(lang);

    useEffect(() => {
        langRef.current = lang;
    }, [lang]);

    // Initialize map
    useEffect(() => {
        if (mapRef.current) return;

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

        map.on('moveend', () => {
            const center = map.getCenter();
            localStorage.setItem('map_lat', center.lat.toString());
            localStorage.setItem('map_lng', center.lng.toString());
            localStorage.setItem('map_zoom', Math.round(map.getZoom()).toString());
        });

        map.on('click', async (e) => {
            // Check if a route line was clicked
            const features = map.queryRenderedFeatures(e.point);
            const routeFeature = features.find(f => f.layer && f.layer.id && f.layer.id.startsWith('route-line-'));
            if (routeFeature) {
                const idx = parseInt(routeFeature.layer.id.replace('route-line-', ''));
                if (!isNaN(idx)) {
                    onRouteSelect?.(idx);
                    return;
                }
            }
            
            const { lat, lng } = e.lngLat;
            const place = await reverseGeocode(lat, lng, langRef.current);
            onMapClick?.(place);
        });

        map.addControl(new maplibregl.ScaleControl({ maxWidth: 80, unit: 'metric' }), 'bottom-right');

        map.on('load', () => {
            applyStyleTweaks(map);
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
                map.once('styledata', () => {
                    setTimeout(() => {
                        applyStyleTweaks(map);
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

        clearRouteLabels() {
            routeLabelsRef.current.forEach((m) => m.remove());
            routeLabelsRef.current = [];
        },

        drawRoutes(routes, activeIndex = 0, originCoords, destCoords, mode = 'driving') {
            if (!mapRef.current || !routes || routes.length === 0) return;
            const map = mapRef.current;

            this.clearRoute();

            const addRouteLayers = () => {
                // Draw inactive routes first (under active)
                routes.forEach((route, index) => {
                    const isActive = index === activeIndex;
                    const sourceId = `route-${index}`;
                    const outlineId = `route-outline-${index}`;
                    const lineId = `route-line-${index}`;

                    map.addSource(sourceId, {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            properties: { routeIndex: index },
                            geometry: route.geometry,
                        },
                    });

                    let lineColor = isActive ? '#1a73e8' : '#70757a';
                    let lineOpacity = isActive ? 1 : 0.6;
                    let dashArray = undefined;

                    if (isActive && mode === 'walking') {
                        lineColor = '#4285f4';
                        dashArray = [0.1, 1.5];
                    } else if (isActive && mode === 'cycling') {
                        lineColor = '#34a853';
                        dashArray = [4, 4];
                    }

                    // Outline
                    if (mode !== 'walking' || !isActive) {
                        map.addLayer({
                            id: outlineId,
                            type: 'line',
                            source: sourceId,
                            layout: { 'line-join': 'round', 'line-cap': 'round' },
                            paint: {
                                'line-color': isActive ? '#ffffff' : '#e8eaed',
                                'line-width': isActive ? 10 : 8,
                                'line-opacity': 0.8,
                            },
                        });
                    }

                    // Main route line
                    map.addLayer({
                        id: lineId,
                        type: 'line',
                        source: sourceId,
                        layout: { 'line-join': 'round', 'line-cap': 'round' },
                        paint: {
                            'line-color': lineColor,
                            'line-width': isActive ? 6 : 5,
                            'line-opacity': lineOpacity,
                            ...(dashArray ? { 'line-dasharray': dashArray } : {}),
                        },
                    });

                    // Make inactive routes clickable (pointer cursor)
                    if (!isActive) {
                        map.on('mouseenter', lineId, () => {
                            map.getCanvas().style.cursor = 'pointer';
                        });
                        map.on('mouseleave', lineId, () => {
                            map.getCanvas().style.cursor = '';
                        });
                    }
                });

                // Traffic overlay on active route
                if (mode === 'driving') {
                    const activeRoute = routes[activeIndex];
                    const trafficSegments = getTrafficSegments(
                        activeRoute.geometry,
                        activeRoute.weight || activeRoute.rawDuration,
                        activeRoute.rawDuration,
                        parseFloat(activeRoute.distance) * 1000
                    );
                    trafficSegments.forEach((seg, i) => {
                        const segSourceId = `traffic-${i}`;
                        const segLayerId = `traffic-line-${i}`;
                        map.addSource(segSourceId, {
                            type: 'geojson',
                            data: {
                                type: 'Feature',
                                properties: {},
                                geometry: { type: 'LineString', coordinates: seg.coordinates },
                            },
                        });
                        map.addLayer({
                            id: segLayerId,
                            type: 'line',
                            source: segSourceId,
                            layout: { 'line-join': 'round', 'line-cap': 'round' },
                            paint: {
                                'line-color': seg.color,
                                'line-width': 4,
                                'line-opacity': 0.7,
                            },
                        });
                    });
                }

                routeLayerRef.current = { count: routes.length };

                // Origin & destination markers
                if (originCoords) {
                    this.addMarker(originCoords.lat, originCoords.lon, 'Origin', 'green');
                }
                if (destCoords) {
                    this.addMarker(destCoords.lat, destCoords.lon, 'Destination', 'red');
                }

                // Route duration label markers at midpoint of each route
                this.clearRouteLabels();
                routes.forEach((route, index) => {
                    const coords = route.geometry.coordinates;
                    const midIdx = Math.floor(coords.length / 2);
                    const mid = coords[midIdx];
                    if (!mid) return;

                    const isActive = index === activeIndex;
                    const el = document.createElement('div');
                    el.className = `route-label ${isActive ? 'route-label-active' : 'route-label-inactive'}`;
                    el.innerHTML = `<span>${route.duration}</span>`;
                    el.style.cursor = 'pointer';
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        onRouteSelect?.(index);
                    });

                    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                        .setLngLat(mid)
                        .addTo(map);
                    routeLabelsRef.current.push(marker);
                });

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
                    // Clear traffic layers
                    for (let i = 0; i < 30; i++) {
                        if (mapRef.current.getLayer(`traffic-line-${i}`)) mapRef.current.removeLayer(`traffic-line-${i}`);
                        if (mapRef.current.getSource(`traffic-${i}`)) mapRef.current.removeSource(`traffic-${i}`);
                    }
                } catch (e) {
                    // Layers may not exist
                }
                routeLayerRef.current = false;
            }
            this.clearMarkers();
            this.clearRouteLabels();
        },

        // Navigation mode
        startNavigation(route) {
            if (!mapRef.current) return;
            const map = mapRef.current;
            navFollowRef.current = true;

            // Create blue navigation arrow
            const el = document.createElement('div');
            el.className = 'nav-arrow-container';
            el.innerHTML = `
                <div class="nav-arrow">
                    <svg width="36" height="36" viewBox="0 0 36 36">
                        <defs>
                            <filter id="nav-glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="2" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                        </defs>
                        <polygon points="18,2 28,30 18,24 8,30" fill="#4285f4" stroke="white" stroke-width="2" filter="url(#nav-glow)" />
                    </svg>
                </div>
            `;

            if (navArrowRef.current) navArrowRef.current.remove();
            
            // Get current position to place arrow
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const { latitude: lat, longitude: lng } = pos.coords;
                        navArrowRef.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
                            .setLngLat([lng, lat])
                            .addTo(map);
                        
                        map.flyTo({ center: [lng, lat], zoom: 17, duration: 1500, pitch: 45 });
                    },
                    () => {
                        // Fallback: place arrow at route start
                        const start = route.geometry.coordinates[0];
                        navArrowRef.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map' })
                            .setLngLat(start)
                            .addTo(map);
                        map.flyTo({ center: start, zoom: 17, duration: 1500, pitch: 45 });
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            }
        },

        updateNavPosition(lat, lng, heading) {
            if (!mapRef.current) return;
            const map = mapRef.current;

            if (navArrowRef.current) {
                navArrowRef.current.setLngLat([lng, lat]);
                // Rotate arrow based on heading
                if (heading !== null && heading !== undefined) {
                    navArrowRef.current.setRotation(heading);
                }
            }

            // Auto-follow
            if (navFollowRef.current) {
                map.easeTo({ 
                    center: [lng, lat], 
                    duration: 500,
                    bearing: heading || map.getBearing(),
                });
            }
        },

        stopNavigation() {
            if (navArrowRef.current) {
                navArrowRef.current.remove();
                navArrowRef.current = null;
            }
            navFollowRef.current = false;
            if (mapRef.current) {
                mapRef.current.easeTo({ pitch: 0, bearing: 0, duration: 500 });
            }
        },

        setNavFollow(follow) {
            navFollowRef.current = follow;
        },

        recenter() {
            navFollowRef.current = true;
            if (navArrowRef.current && mapRef.current) {
                const lngLat = navArrowRef.current.getLngLat();
                mapRef.current.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: 17, duration: 1000 });
            }
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

                    if (locationMarkerRef.current) locationMarkerRef.current.remove();
                    if (locationCircleRef.current) {
                        try {
                            if (map.getLayer('location-circle')) map.removeLayer('location-circle');
                            if (map.getSource('location-circle')) map.removeSource('location-circle');
                        } catch (e) { /* ignore */ }
                    }

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
