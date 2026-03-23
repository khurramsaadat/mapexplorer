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

function getManeuverSVG(step) {
  if (!step) return null;
  const instr = (step.instruction || '').toLowerCase();
  const type = (step.maneuver?.type || '').toLowerCase();
  const mod = (step.maneuver?.modifier || '').toLowerCase();

  const iconStyle = { width: 32, height: 32, strokeWidth: 2.5, stroke: 'white', fill: 'none' };

  if (type === 'arrive') {
    return (
      <svg viewBox="0 0 24 24" style={iconStyle}>
        <circle cx="12" cy="12" r="4" fill="white" stroke="none" />
        <circle cx="12" cy="12" r="9" strokeDasharray="3 2" />
      </svg>
    );
  }
  if (type === 'depart') {
    return (
      <svg viewBox="0 0 24 24" style={iconStyle}>
        <path d="M12 4v16M5 11l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === 'roundabout' || type === 'rotary') {
    return (
      <svg viewBox="0 0 24 24" style={iconStyle}>
        <circle cx="12" cy="12" r="5" />
        <path d="M17 12a5 5 0 0 0-9.5-2.2" strokeLinecap="round" />
        <path d="M7 7.5l.5 2.5 2.5-.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (mod === 'sharp left' || instr.includes('sharp left')) {
    return (
      <svg viewBox="0 0 24 24" style={iconStyle}>
        <path d="M18 20V10H6M6 10l4-4M6 10l4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (mod === 'sharp right' || instr.includes('sharp right')) {
    return (
      <svg viewBox="0 0 24 24" style={iconStyle}>
        <path d="M6 20V10h12M18 10l-4-4M18 10l-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (mod === 'slight left' || instr.includes('slight left')) {
    return (
      <svg viewBox="0 0 24 24" style={iconStyle}>
        <path d="M12 20V6M12 6l-5 5M8 4l-3 3 3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (mod === 'slight right' || instr.includes('slight right')) {
    return (
      <svg viewBox="0 0 24 24" style={iconStyle}>
        <path d="M12 20V6M12 6l5 5M16 4l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (mod === 'left' || instr.includes('turn left')) {
    return (
      <svg viewBox="0 0 24 24" style={iconStyle}>
        <path d="M8 20V9M8 9l-4 4M8 9l4 4M16 5h-4a4 4 0 0 0-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (mod === 'right' || instr.includes('turn right')) {
    return (
      <svg viewBox="0 0 24 24" style={iconStyle}>
        <path d="M16 20V9M16 9l4 4M16 9l-4 4M8 5h4a4 4 0 0 1 4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // Default: straight arrow
  return (
    <svg viewBox="0 0 24 24" style={iconStyle}>
      <path d="M12 20V4M5 11l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Dubai Demo constants
const DEMO_ORIGIN = { lat: 25.1972, lng: 55.2744, name: 'Burj Khalifa, Dubai' };
const DEMO_DEST = { lat: 25.2528, lng: 55.3617, name: 'Dubai Intl Airport Terminal 3' };

export default function Home() {
  const mapRef = useRef(null);
  const simulationStopFnRef = useRef(null);
  const simSpeedIntervalRef = useRef(null);
  // Ref so the simulation closure always reads the latest speed
  const simulatedSpeedRef = useRef(null);

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
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [navRoute, setNavRoute] = useState(null);
  const [navMode, setNavMode] = useState('driving');
  const [liveSpeed, setLiveSpeed] = useState(null);
  const [simulatedSpeed, setSimulatedSpeed] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [navStepIndex, setNavStepIndex] = useState(0);
  const [remainingDuration, setRemainingDuration] = useState(null);
  const [remainingDistance, setRemainingDistance] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const watchIdRef = useRef(null);
  const userLocWatchIdRef = useRef(null);
  const navStartTimeRef = useRef(null);

  // --- Callbacks ---

  const showToast = useCallback((message) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3500);
  }, []);

  const handleLocate = useCallback(() => {
    mapRef.current?.locateUser();
    showToast(t.findingLocation);
  }, [showToast, t.findingLocation]);

  const handleRecenter = useCallback(() => {
    if (userLocation) {
      mapRef.current?.flyTo(userLocation.lat, userLocation.lon, 18);
    } else {
      mapRef.current?.locateUser();
    }
  }, [userLocation]);

  const handlePlaceSelect = useCallback((place) => {
    mapRef.current?.clearMarkers();
    mapRef.current?.flyTo(place.lat, place.lon, 16);
    mapRef.current?.addMarker(place.lat, place.lon, `<strong>${place.name}</strong><br/>${place.fullAddress}`, 'blue');
    setSelectedPlace(place);
  }, []);

  const handleMapClick = useCallback((place) => {
    if (!place) return;
    mapRef.current?.clearMarkers();
    mapRef.current?.addMarker(place.lat, place.lon, `<strong>${place.name}</strong>`, 'default');
    setSelectedPlace(place);
  }, []);

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

  const handleRouteSelect = useCallback((index) => {
    setMapRouteSelectIndex(index);
  }, []);

  const stopSimulation = useCallback(() => {
    if (simulationStopFnRef.current) {
      simulationStopFnRef.current();
      simulationStopFnRef.current = null;
    }
    if (simSpeedIntervalRef.current) {
      clearInterval(simSpeedIntervalRef.current);
      simSpeedIntervalRef.current = null;
    }
    simulatedSpeedRef.current = null;
    setSimulatedSpeed(null);
  }, []);

  const handleEndJourney = useCallback(() => {
    stopSimulation();
    setIsNavigating(false);
    setNavRoute(null);
    setLiveSpeed(null);
    setCurrentStep(null);
    setNavStepIndex(0);
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
  }, [showToast, t.navEnded, stopSimulation]);

  const handleStartJourney = useCallback((route) => {
    setIsNavigating(true);
    setNavRoute(route);
    setDirectionsOpen(false);
    setRemainingDuration(route.rawDuration);
    setRemainingDistance(route.distance);
    setCurrentStep(route.steps?.[0] || null);
    setNavStepIndex(0);
    navStartTimeRef.current = Date.now();

    mapRef.current?.startNavigation(route);
    mapRef.current?.flyTo(route.steps[0].maneuver.location[1], route.steps[0].maneuver.location[0], 18);

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, speed, heading } = pos.coords;
          if (speed !== null) setLiveSpeed(Math.round(speed * 3.6));
          mapRef.current?.updateNavPosition(latitude, longitude, heading);
          if (navStartTimeRef.current && route.rawDuration) {
            const elapsed = (Date.now() - navStartTimeRef.current) / 1000;
            const remaining = Math.max(0, route.rawDuration - elapsed);
            const mins = Math.round(remaining / 60);
            setRemainingDuration(mins > 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} min` : `${mins} min`);
          }
        },
        null,
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }
    showToast(t.navStarted);
  }, [showToast, t.navStarted]);

  const handleQuickStart = useCallback(async (place) => {
    if (!userLocation) {
      showToast('Waiting for GPS...');
      return;
    }
    showToast('Calculating fast route...');
    const { getDirections } = await import('@/lib/api');
    const routes = await getDirections(userLocation.lat, userLocation.lon, place.lat, place.lon);
    if (routes && routes.length > 0) {
      handleStartJourney(routes[0]);
      setSelectedPlace(null);
    } else {
      showToast('Could not find a route.');
    }
  }, [userLocation, handleStartJourney, showToast]);

  const handleDemoNavigation = useCallback(async () => {
    if (isDemoLoading || isNavigating) return;
    setIsDemoLoading(true);

    try {
      // Step 1: Zero in on start location with top-down overview
      showToast('📍 Your location: Burj Khalifa, Dubai');
      mapRef.current?.flyTo(DEMO_ORIGIN.lat, DEMO_ORIGIN.lng, 16);
      setUserLocation({ lat: DEMO_ORIGIN.lat, lon: DEMO_ORIGIN.lng });
      mapRef.current?.setUserMarker(DEMO_ORIGIN.lat, DEMO_ORIGIN.lng);

      // Let user see their start location
      await new Promise(r => setTimeout(r, 1400));

      // Step 2: Calculate route
      showToast('Calculating route to Dubai Airport T3...');
      const { getDirections } = await import('@/lib/api');
      const routes = await getDirections(
        DEMO_ORIGIN.lat, DEMO_ORIGIN.lng,
        DEMO_DEST.lat, DEMO_DEST.lng,
        'driving', 3
      );

      if (!routes || routes.length === 0) {
        showToast('Could not calculate route. Check internet connection.');
        setIsDemoLoading(false);
        return;
      }

      const route = routes[0];
      setNavMode('driving');

      // Step 3: Show route overview
      mapRef.current?.drawRoutes(
        routes, 0,
        { lat: DEMO_ORIGIN.lat, lon: DEMO_ORIGIN.lng },
        { lat: DEMO_DEST.lat, lon: DEMO_DEST.lng },
        'driving'
      );

      showToast(`🗺 ${route.duration} · ${route.distance} to Dubai Airport T3`);
      // Give user time to see the full route
      await new Promise(r => setTimeout(r, 2000));

      // Step 4: Start navigation HUD
      setIsNavigating(true);
      setNavRoute(route);
      setDirectionsOpen(false);
      setSelectedPlace(null);
      setRemainingDuration(route.rawDuration);
      setRemainingDistance(route.distance);
      setCurrentStep(route.steps?.[0] || null);
      setNavStepIndex(0);
      navStartTimeRef.current = Date.now();

      // Place arrow and fly in close with 60° perspective tilt
      mapRef.current?.startNavigation(route, { lat: DEMO_ORIGIN.lat, lng: DEMO_ORIGIN.lng });

      showToast('🚗 Navigating to Dubai Airport Terminal 3');

      // Step 5: Wait for the fly-in zoom animation to complete, THEN start driving
      await new Promise(r => setTimeout(r, 2500));

      // Simulated speed (city: ~45–85 km/h with variation)
      const baseSpeed = 62;
      simulatedSpeedRef.current = baseSpeed;
      setSimulatedSpeed(baseSpeed);
      simSpeedIntervalRef.current = setInterval(() => {
        const v = Math.max(20, baseSpeed + Math.round((Math.random() - 0.5) * 40));
        simulatedSpeedRef.current = v;
        setSimulatedSpeed(v);
      }, 2000);

      // Total sim time: ~600 ticks × 100ms = ~60 seconds of driving
      const totalSimSeconds = 60;

      let arrivedOnce = false;
      const stopFn = mapRef.current?.simulateNavigation(
        route.geometry.coordinates,
        {
          steps: route.steps,
          onPositionUpdate: (lat, lng, bearing) => {
            // Pass current speed so zoom auto-adjusts
            mapRef.current?.updateNavPosition(lat, lng, bearing, simulatedSpeedRef.current);

            const elapsed = (Date.now() - navStartTimeRef.current) / 1000;
            const progress = Math.min(elapsed / totalSimSeconds, 1);
            const remainSecs = Math.max(0, route.rawDuration * (1 - progress));
            const mins = Math.round(remainSecs / 60);
            setRemainingDuration(
              mins > 60 ? `${Math.floor(mins / 60)} hr ${mins % 60} min` : `${mins} min`
            );
            const distNum = parseFloat(route.distance);
            const remainDist = (distNum * (1 - progress)).toFixed(1);
            setRemainingDistance(
              parseFloat(remainDist) < 1
                ? `${Math.round(parseFloat(remainDist) * 1000)} m`
                : `${remainDist} km`
            );
          },
          onStepUpdate: (step, idx) => {
            setCurrentStep(step);
            setNavStepIndex(idx);
          },
          onComplete: () => {
            if (arrivedOnce) return;
            arrivedOnce = true;
            stopSimulation();
            simulatedSpeedRef.current = 0;
            setSimulatedSpeed(0);
            showToast('🎉 Arrived at Dubai Airport Terminal 3!');
            setTimeout(() => {
              setIsNavigating(false);
              setNavRoute(null);
              setCurrentStep(null);
              setSimulatedSpeed(null);
              simulatedSpeedRef.current = null;
              mapRef.current?.stopNavigation();
              mapRef.current?.clearRoute();
            }, 3500);
          },
        }
      );

      simulationStopFnRef.current = stopFn;
    } catch (err) {
      console.error('Demo navigation error:', err);
      showToast('Demo failed. Check connection.');
    } finally {
      setIsDemoLoading(false);
    }
  }, [isDemoLoading, isNavigating, showToast, stopSimulation]);

  const handleLayerChange = useCallback((layer) => setCurrentLayer(layer), []);
  const handleLangToggle = useCallback(() => setLang((prev) => (prev === 'en' ? 'ar' : 'en')), []);
  const handleZoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => mapRef.current?.zoomOut(), []);

  const handleFullscreenToggle = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        showToast(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }, [showToast]);

  const handleSettingsChange = useCallback((newSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    if (newSettings.autoDarkMode) {
      const dark = shouldBeDark();
      setIsDark(dark);
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    }
  }, []);

  // --- Effects ---

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    const dark = s.autoDarkMode ? shouldBeDark() : false;
    setIsDark(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (navigator.geolocation) {
      setTimeout(() => handleLocate(), 1000);
    }
  }, [handleLocate]);

  useEffect(() => {
    document.documentElement.setAttribute('dir', getDirection(lang));
  }, [lang]);

  useEffect(() => {
    if (navigator.geolocation) {
      userLocWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        null,
        { enableHighAccuracy: true }
      );
    }
    return () => {
      if (userLocWatchIdRef.current) navigator.geolocation.clearWatch(userLocWatchIdRef.current);
    };
  }, []);

  // Derive next step for preview
  const nextStep = navRoute?.steps?.[navStepIndex + 1] || null;
  const displaySpeed = liveSpeed ?? simulatedSpeed;

  return (
    <>
      {/* ===== Navigation HUD ===== */}
      {isNavigating && navRoute && (
        <>
          {/* TOP: Waze-style turn instruction card */}
          <div className="nav-hud-container">
            <div className="nav-turn-card">
              <div className="nav-turn-icon-wrap">
                {getManeuverSVG(currentStep)}
              </div>
              <div className="nav-turn-info">
                <div className="nav-turn-distance">
                  {currentStep?.distance || navRoute.distance}
                </div>
                <div className="nav-turn-street">
                  {currentStep?.name
                    ? currentStep.name
                    : (currentStep?.instruction || 'Proceed on route')}
                </div>
                {currentStep?.instruction && currentStep?.name && (
                  <div className="nav-turn-instruction">
                    {currentStep.instruction}
                  </div>
                )}
              </div>
            </div>

            {/* Next step preview */}
            {nextStep && (
              <div className="nav-next-step">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.7, flexShrink: 0 }}>
                  <path d="M12 20V4M5 11l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="nav-next-step-label">Then</span>
                <span className="nav-next-step-instruction">
                  {nextStep.name || nextStep.instruction}
                </span>
                <span className="nav-next-step-dist">{nextStep.distance}</span>
              </div>
            )}

            {/* Lane assist */}
            {navRoute.steps?.[navStepIndex]?.lanes && (
              <div className="lane-assist-banner">
                <div className="lane-assist-label">Keep in lanes</div>
                <div className="lane-indicators">
                  {navRoute.steps[navStepIndex].lanes.map((isValid, i) => (
                    <div key={i} className={`lane-icon ${isValid ? 'valid' : 'invalid'}`}>↑</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM: Google Maps style ETA bar */}
          <div className="nav-bottom-bar" id="nav-eta-banner">
            {/* Speed badge (Waze style) */}
            <div className="nav-speed-circle">
              <span className="nav-speed-value">
                {displaySpeed !== null ? displaySpeed : '--'}
              </span>
              <span className="nav-speed-unit">km/h</span>
            </div>

            {/* ETA info */}
            <div className="nav-bottom-info">
              <span className="nav-bottom-time">
                {typeof remainingDuration === 'string'
                  ? remainingDuration
                  : navRoute.duration}
              </span>
              <span className="nav-bottom-dot">·</span>
              <span className="nav-bottom-dist">
                {remainingDistance || navRoute.distance}
              </span>
              <span className="nav-bottom-dot">·</span>
              <span className="nav-bottom-arrival">
                {calculateETA(navRoute.rawDuration)}
              </span>
            </div>

            {/* End button */}
            <button className="nav-end-btn" onClick={handleEndJourney} id="end-nav-btn" aria-label="End navigation">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Re-center button */}
          <button className="nav-recenter-btn" onClick={handleRecenter} title={t.recenter} id="recenter-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            </svg>
          </button>
        </>
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
          userLocation={userLocation}
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
          onStart={handleQuickStart}
          t={t}
        />
      )}

      {/* Demo Navigation Button */}
      {!isNavigating && !directionsOpen && !selectedPlace && (
        <button
          className={`demo-nav-btn ${isDemoLoading ? 'loading' : ''}`}
          onClick={handleDemoNavigation}
          disabled={isDemoLoading}
          id="demo-nav-btn"
        >
          {isDemoLoading ? (
            <>
              <div className="demo-btn-spinner" />
              Calculating route...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 12l4-4M3 12l4 4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="17" cy="12" r="4" strokeWidth="1.5" />
              </svg>
              Demo: Burj Khalifa → Dubai Airport T3
            </>
          )}
        </button>
      )}

      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}
