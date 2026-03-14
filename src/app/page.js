'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '@/components/SearchBar';
import DirectionsPanel from '@/components/DirectionsPanel';
import MapControls from '@/components/MapControls';
import PlaceCard from '@/components/PlaceCard';
import Toast from '@/components/Toast';
import { shouldBeDark, getTranslations, getDirection } from '@/lib/i18n';

// Dynamically import MapView to avoid SSR issues with Leaflet
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div className="loading-spinner" />
    </div>
  ),
});

export default function Home() {
  const mapRef = useRef(null);

  // Auto dark mode based on local time
  const [isDark, setIsDark] = useState(false);
  const [currentLayer, setCurrentLayer] = useState('streets');
  const [lang, setLang] = useState('en');
  const t = getTranslations(lang);

  // UI state
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [directionsDestination, setDirectionsDestination] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync fullscreen state with DOM api if user presses Esc
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Initialize auto theme on mount (CSS filter on tiles handles dark map look)
  useEffect(() => {
    const dark = shouldBeDark();
    setIsDark(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, []);

  // Update direction attribute when language changes
  useEffect(() => {
    document.documentElement.setAttribute('dir', getDirection(lang));
  }, [lang]);

  const showToast = useCallback((message) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  }, []);

  // Search → fly to place
  const handlePlaceSelect = useCallback((place) => {
    mapRef.current?.clearMarkers();
    mapRef.current?.flyTo(place.lat, place.lon, 16);
    mapRef.current?.addMarker(place.lat, place.lon, `<strong>${place.name}</strong><br/>${place.fullAddress}`, 'blue');
    setSelectedPlace(place);
  }, []);

  // Map click → reverse geocode
  const handleMapClick = useCallback((place) => {
    if (!place) return;
    mapRef.current?.clearMarkers();
    mapRef.current?.addMarker(place.lat, place.lon, `<strong>${place.name}</strong>`, 'default');
    setSelectedPlace(place);
  }, []);

  // Directions
  const handleDirectionsOpen = useCallback(() => {
    setDirectionsOpen(true);
    setSelectedPlace(null);
  }, []);

  const handleRouteFound = useCallback((route, originCoords, destCoords) => {
    mapRef.current?.drawRoute(route.geometry, originCoords, destCoords);
  }, []);

  const handleClearRoute = useCallback(() => {
    mapRef.current?.clearRoute();
  }, []);

  const handleDirectionsToPlace = useCallback((place) => {
    setDirectionsDestination(place);
    setDirectionsOpen(true);
    setSelectedPlace(null);
  }, []);

  // Location
  const handleLocate = useCallback(() => {
    mapRef.current?.locateUser();
    showToast(t.findingLocation);
  }, [showToast, t.findingLocation]);

  // Layers (independent from dark mode — CSS filter handles dark appearance)
  const handleLayerChange = useCallback((layer) => {
    setCurrentLayer(layer);
  }, []);

  // Theme (changes tiles to dark layer and sets css variables)
  const handleThemeToggle = useCallback(() => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.setAttribute('data-theme', newDark ? 'dark' : 'light');
    setCurrentLayer(newDark ? 'dark' : 'streets');
  }, [isDark]);

  // Language
  const handleLangToggle = useCallback(() => {
    setLang((prev) => (prev === 'en' ? 'ar' : 'en'));
  }, []);

  // Fullscreen
  const handleFullscreenToggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        showToast(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [showToast]);

  // Zoom
  const handleZoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => mapRef.current?.zoomOut(), []);

  return (
    <>
      <MapView
        ref={mapRef}
        onMapClick={handleMapClick}
        currentLayer={currentLayer}
        lang={lang}
        isDark={isDark}
      />

      {!directionsOpen && (
        <SearchBar
          onPlaceSelect={handlePlaceSelect}
          onDirectionsOpen={handleDirectionsOpen}
          t={t}
          lang={lang}
        />
      )}

      <DirectionsPanel
        isOpen={directionsOpen}
        onClose={() => setDirectionsOpen(false)}
        onRouteFound={handleRouteFound}
        onClearRoute={handleClearRoute}
        initialDestination={directionsDestination}
        t={t}
        lang={lang}
      />

      <MapControls
        onLocate={handleLocate}
        onLayerChange={handleLayerChange}
        currentLayer={currentLayer}
        onThemeToggle={handleThemeToggle}
        isDark={isDark}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        lang={lang}
        onLangToggle={handleLangToggle}
        isFullscreen={isFullscreen}
        onFullscreenToggle={handleFullscreenToggle}
        t={t}
      />

      {selectedPlace && !directionsOpen && (
        <PlaceCard
          place={selectedPlace}
          onClose={() => {
            setSelectedPlace(null);
            mapRef.current?.clearMarkers();
          }}
          onDirections={handleDirectionsToPlace}
          t={t}
        />
      )}

      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}
