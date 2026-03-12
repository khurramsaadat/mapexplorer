'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { tileLayers, defaultCenter, defaultZoom } from '@/lib/tiles';
import { reverseGeocode } from '@/lib/api';

// Fix default marker icon issue in Leaflet + webpack/next
const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const blueIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const redIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const greenIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

const MapView = forwardRef(function MapView({ onMapClick, currentLayer }, ref) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const tileLayerRef = useRef(null);
    const markersRef = useRef([]);
    const routeLayerRef = useRef(null);
    const locationMarkerRef = useRef(null);
    const locationCircleRef = useRef(null);

    // Initialize map
    useEffect(() => {
        if (mapRef.current) return;

        // Restore state from localStorage
        const savedLat = parseFloat(localStorage.getItem('map_lat')) || defaultCenter[0];
        const savedLng = parseFloat(localStorage.getItem('map_lng')) || defaultCenter[1];
        const savedZoom = parseInt(localStorage.getItem('map_zoom')) || defaultZoom;

        const map = L.map(mapContainerRef.current, {
            center: [savedLat, savedLng],
            zoom: savedZoom,
            zoomControl: false,
            attributionControl: true,
        });

        const layer = tileLayers.streets;
        tileLayerRef.current = L.tileLayer(layer.url, {
            attribution: layer.attribution,
            maxZoom: 19,
        }).addTo(map);

        // Save state on move
        map.on('moveend', () => {
            const center = map.getCenter();
            localStorage.setItem('map_lat', center.lat.toString());
            localStorage.setItem('map_lng', center.lng.toString());
            localStorage.setItem('map_zoom', map.getZoom().toString());
        });

        // Click to explore
        map.on('click', async (e) => {
            const { lat, lng } = e.latlng;
            const place = await reverseGeocode(lat, lng);
            onMapClick?.(place);
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Change tile layer
    useEffect(() => {
        if (!mapRef.current || !currentLayer) return;
        const layer = tileLayers[currentLayer];
        if (!layer) return;

        if (tileLayerRef.current) {
            mapRef.current.removeLayer(tileLayerRef.current);
        }
        tileLayerRef.current = L.tileLayer(layer.url, {
            attribution: layer.attribution,
            maxZoom: 19,
        }).addTo(mapRef.current);
    }, [currentLayer]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        flyTo(lat, lon, zoom = 16) {
            mapRef.current?.flyTo([lat, lon], zoom, { duration: 1.5 });
        },

        addMarker(lat, lon, popupText, icon = 'default') {
            if (!mapRef.current) return;
            const iconMap = { blue: blueIcon, red: redIcon, green: greenIcon, default: defaultIcon };
            const marker = L.marker([lat, lon], { icon: iconMap[icon] || defaultIcon })
                .addTo(mapRef.current);
            if (popupText) marker.bindPopup(popupText);
            markersRef.current.push(marker);
            return marker;
        },

        clearMarkers() {
            markersRef.current.forEach((m) => mapRef.current?.removeLayer(m));
            markersRef.current = [];
        },

        drawRoute(geometry, originCoords, destCoords) {
            if (!mapRef.current) return;

            // Clear previous
            if (routeLayerRef.current) {
                mapRef.current.removeLayer(routeLayerRef.current);
            }
            this.clearMarkers();

            // Draw polyline
            const coords = geometry.coordinates.map(([lon, lat]) => [lat, lon]);
            routeLayerRef.current = L.polyline(coords, {
                color: '#4285f4',
                weight: 5,
                opacity: 0.85,
                smoothFactor: 1,
            }).addTo(mapRef.current);

            // Add origin & destination markers
            if (originCoords) {
                this.addMarker(originCoords.lat, originCoords.lon, 'Origin', 'green');
            }
            if (destCoords) {
                this.addMarker(destCoords.lat, destCoords.lon, 'Destination', 'red');
            }

            // Fit bounds
            mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [60, 60] });
        },

        clearRoute() {
            if (routeLayerRef.current && mapRef.current) {
                mapRef.current.removeLayer(routeLayerRef.current);
                routeLayerRef.current = null;
            }
            this.clearMarkers();
        },

        locateUser() {
            if (!mapRef.current) return;
            mapRef.current.locate({ setView: true, maxZoom: 16 });

            mapRef.current.once('locationfound', (e) => {
                const { lat, lng } = e.latlng;
                const accuracy = e.accuracy;

                // Remove old location markers
                if (locationMarkerRef.current) mapRef.current.removeLayer(locationMarkerRef.current);
                if (locationCircleRef.current) mapRef.current.removeLayer(locationCircleRef.current);

                // Accuracy circle
                locationCircleRef.current = L.circle([lat, lng], {
                    radius: accuracy,
                    color: '#4285f4',
                    fillColor: '#4285f4',
                    fillOpacity: 0.1,
                    weight: 1,
                }).addTo(mapRef.current);

                // Location dot
                const pulseIcon = L.divIcon({
                    className: 'location-pulse-container',
                    html: '<div class="location-pulse"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                });

                locationMarkerRef.current = L.marker([lat, lng], { icon: pulseIcon })
                    .addTo(mapRef.current)
                    .bindPopup('You are here');
            });

            mapRef.current.once('locationerror', () => {
                console.warn('Location access denied');
            });
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
        <div className="map-wrapper">
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
});

export default MapView;
