'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import SearchBar from '@/components/SearchBar';
import DirectionsPanel from '@/components/DirectionsPanel';
import MapControls from '@/components/MapControls';
import PlaceCard from '@/components/PlaceCard';
import Toast from '@/components/Toast';
import SettingsPanel, { loadSettings, saveSettings } from '@/components/SettingsPanel';
import { shouldBeDark, getTranslations, getDirection } from '@/lib/i18n';

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

function calculateETA(durationSeconds) {
  const now = new Date();
  const eta = new Date(now.getTime() + durationSeconds * 1000);
  return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Home() {
  const mapRef = useRef(null);

  const [isDark, setIsDark] = useState(false);
  const [currentLayer, setCurrentLayer] = useState('streets');
  const [lang, setLang] = useState('en');
  const [settings, setSettings] = useState(loadSettings());
  const t = getTranslations(lang);

  // UI state
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [directionsDestination, setDirectionsDestination] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapRouteSelectIndex, setMapRouteSelectIndex] = useState(null);

  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [navRoute, setNavRoute] = useState(null);
  const [navMode, setNavMode] = useState('driving');
  const [liveSpeed, setLiveSpeed] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [remainingDuration, setRemainingDuration] = useState(null);
  const [remainingDistance, setRemainingDistance] = useState(null);
  const watchIdRef = useRef(null);
  const navStartTimeRef = useRef(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Initialize auto theme
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    const dark = s.autoDarkMode ? shouldBeDark() : false;
    setIsDark(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, []);

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

  const handleRouteFound = useCallback((routes, activeIndex, originCoords, destCoords, mode) => {
    setNavMode(mode);
    mapRef.current?.drawRoutes(routes, activeIndex, originCoords, destCoords, mode);
  }, []);

  const handleClearRoute = useCallback(() => {
    mapRef.current?.clearRoute();
  }, []);

  const handleDirectionsToPlace = useCallback((place) => {
    setDirectionsDestination(place);
    setDirectionsOpen(true);
    setSelectedPlace(null);
  }, []);

  // Route selection from map (tapping on route line or label)
  const handleRouteSelect = useCallback((index) => {
    setMapRouteSelectIndex(index);
  }, []);

  // Start Journey
  const handleStartJourney = useCallback((route) => {
    setIsNavigating(true);
    setNavRoute(route);
    setDirectionsOpen(false);
    setRemainingDuration(route.rawDuration);
    setRemainingDistance(route.distance);
    setCurrentStep(route.steps?.[0] || null);
    navStartTimeRef.current = Date.now();

    // Start navigation mode on map (zoom, arrow)
    mapRef.current?.startNavigation(route);

    // Start position tracking
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const speed = pos.coords.speed;
          const heading = pos.coords.heading;

          if (speed !== null) {
            setLiveSpeed(Math.round(speed * 3.6));
          }

          // Update arrow position on map
          mapRef.current?.updateNavPosition(latitude, longitude, heading);

          // Update remaining time estimate
          if (navStartTimeRef.current && route.rawDuration) {
            const elapsed = (Date.now() - navStartTimeRef.current) / 1000;
            const remaining = Math.max(0, route.rawDuration - elapsed);
            const mins = Math.round(remaining / 60);
            if (mins > 60) {
              setRemainingDuration(`${Math.floor(mins / 60)} hr ${mins % 60} min`);
            } else {
              setRemainingDuration(`${mins} min`);
            }
          }
        },
        null,
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }
    showToast(t.navStarted);
  }, [showToast, t.navStarted]);

  // End Journey
  const handleEndJourney = useCallback(() => {
    setIsNavigating(false);
    setNavRoute(null);
    setLiveSpeed(null);
    setCurrentStep(null);
    setRemainingDuration(null);
    setRemainingDistance(null);
    navStartTimeRef.current = null;
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    mapRef.current?.stopNavigation();
    mapRef.current?.clearRoute();
    showToast(t.navEnded);
  }, [showToast, t.navEnded]);

  // Recenter
  const handleRecenter = useCallback(() => {
    mapRef.current?.recenter();
  }, []);

  // Location
  const handleLocate = useCallback(() => {
    mapRef.current?.locateUser();
    showToast(t.findingLocation);
  }, [showToast, t.findingLocation]);

  // Layers
  const handleLayerChange = useCallback((layer) => {
    setCurrentLayer(layer);
  }, []);

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

  // Settings
  const handleSettingsChange = useCallback((newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    if (newSettings.autoDarkMode) {
      const dark = shouldBeDark();
      setIsDark(dark);
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    }
  }, []);

  // Zoom
  const handleZoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => mapRef.current?.zoomOut(), []);

  return (
    <>
      {/* Navigation HUD */}
      {isNavigating && navRoute && (
        <div className="nav-hud-container">
          {/* Current step instruction */}
          {currentStep && (
            <div className="nav-step-banner">
              <div className="nav-step-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {currentStep.instruction?.includes('left') ? (
                    <path d="M15 18l-6-6 6-6" />
                  ) : currentStep.instruction?.includes('right') ? (
                    <path d="M9 18l6-6-6-6" />
                  ) : (
                    <path d="M12 5v14M5 12l7-7 7 7" />
                  )}
                </svg>
              </div>
              <div className="nav-step-text">
                <span className="nav-step-instruction">{currentStep.instruction}</span>
                <span className="nav-step-distance">{currentStep.distance}</span>
              </div>
            </div>
          )}

          {/* Lane Assist */}
          {navRoute.steps?.[0]?.lanes && (
            <div className="lane-assist-banner">
              <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '4px' }}>{t.keepInLanes}</div>
              <div className="lane-indicators">
                {navRoute.steps[0].lanes.map((isValid, i) => (
                  <div key={i} className={`lane-icon ${isValid ? 'valid' : 'invalid'}`}>↑</div>
                ))}
              </div>
            </div>
          )}

          <div className="nav-eta-banner" id="nav-eta-banner">
            <div className="nav-eta-info">
              <span className="nav-eta-time">
                {typeof remainingDuration === 'string' ? remainingDuration : navRoute.duration}
              </span>
              <div className="nav-eta-details">
                <span className="nav-eta-distance">{remainingDistance || navRoute.distance}</span>
                <span className="nav-eta-arrival">ETA: {calculateETA(navRoute.rawDuration)}</span>
              </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
              {liveSpeed !== null && (
                <div className="nav-speed-badge">
                  <span className="nav-speed-value">{liveSpeed}</span>
                  <span className="nav-speed-unit">km/h</span>
                </div>
              )}
              <button className="nav-end-btn" onClick={handleEndJourney} id="end-nav-btn">
                End
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-center button during navigation */}
      {isNavigating && (
        <button className="nav-recenter-btn" onClick={handleRecenter} title={t.recenter} id="recenter-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
          </svg>
        </button>
      )}

      <MapView
        ref={mapRef}
        onMapClick={handleMapClick}
        onRouteSelect={handleRouteSelect}
        currentLayer={currentLayer}
        lang={lang}
        isDark={isDark}
      />

      {!directionsOpen && !isNavigating && (
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
        onStartJourney={handleStartJourney}
        initialDestination={directionsDestination}
        selectedRouteIndex={mapRouteSelectIndex}
        t={t}
        lang={lang}
      />

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        t={t}
      />

      {!isNavigating && (
        <MapControls
          onLocate={handleLocate}
          onLayerChange={handleLayerChange}
          currentLayer={currentLayer}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          lang={lang}
          onLangToggle={handleLangToggle}
          isFullscreen={isFullscreen}
          onFullscreenToggle={handleFullscreenToggle}
          onSettingsOpen={() => setSettingsOpen(true)}
          t={t}
        />
      )}

      {selectedPlace && !directionsOpen && !isNavigating && (
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
