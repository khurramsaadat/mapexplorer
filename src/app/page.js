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
import { speak, stopSpeech, formatNavInstruction, ensureVoicesLoaded } from '@/lib/voice';

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

export default function Home() {
  const mapRef = useRef(null);

  // Render purely client-side to avoid SSR/browser-extension hydration mismatches
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isDark, setIsDark] = useState(false);
  const [currentLayer, setCurrentLayer] = useState('streets');
  const lang = 'en'; // always English
  const [settings, setSettings] = useState(loadSettings());
  const t = getTranslations(lang);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // UI state
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [directionsDestination, setDirectionsDestination] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [mapRouteSelectIndex, setMapRouteSelectIndex] = useState(null);
  const [mapBearing, setMapBearing] = useState(0);

  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [navRoute, setNavRoute] = useState(null);
  const [navMode, setNavMode] = useState('driving');
  const [liveSpeed, setLiveSpeed] = useState(null);
  const [currentStep, setCurrentStep] = useState(null);
  const [navStepIndex, setNavStepIndex] = useState(0);
  const [remainingDuration, setRemainingDuration] = useState(null);
  const [remainingDistance, setRemainingDistance] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const watchIdRef = useRef(null);
  const userLocWatchIdRef = useRef(null);
  const navStartTimeRef = useRef(null);
  // Speed computation from position delta
  const lastNavPosRef = useRef(null);
  const lastNavTimeRef = useRef(null);

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

  const handleBearingChange = useCallback((bearing) => {
    setMapBearing(Math.round(bearing));
  }, []);

  const handleCompassReset = useCallback(() => {
    mapRef.current?.resetNorth();
  }, []);

  const handleEndJourney = useCallback(() => {
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
  }, [showToast, t.navEnded]);

  // Called by MapView when GPS position crosses a step maneuver point
  const handleStepChange = useCallback(({ step, stepIndex, distanceM, type }) => {
    if (type === 'pre-announce') {
      // ~350m warning — "In 350m, turn right…"
      if (voiceEnabledRef.current) {
        const dist = distanceM < 200 ? 'In 200 meters' : 'In 400 meters';
        const instr = formatNavInstruction(step);
        if (instr) speak(`${dist}, ${instr}`);
      }
    } else {
      // At the maneuver — speak and update UI
      setCurrentStep(step);
      setNavStepIndex(stepIndex);
      if (voiceEnabledRef.current) {
        speak(formatNavInstruction(step));
      }
    }
  }, []);

  const handleStartJourney = useCallback((route) => {
    setIsNavigating(true);
    setNavRoute(route);
    setDirectionsOpen(false);
    setRemainingDuration(route.rawDuration);
    setRemainingDistance(route.distance);
    setCurrentStep(route.steps?.[0] || null);
    setNavStepIndex(0);
    navStartTimeRef.current = Date.now();

    mapRef.current?.startNavigation(route, null, navMode);

    // Request fullscreen on navigation start (counts as user gesture)
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    lastNavPosRef.current = null;
    lastNavTimeRef.current = null;

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, speed, heading } = pos.coords;
          const now = Date.now();

          // Compute speed from position delta as fallback
          let deltaKmh = null;
          if (lastNavPosRef.current && lastNavTimeRef.current) {
            const dtS = (now - lastNavTimeRef.current) / 1000;
            if (dtS > 0.3 && dtS < 8) {
              const R = 6371000;
              const dLat = (latitude - lastNavPosRef.current.lat) * Math.PI / 180;
              const dLon = (longitude - lastNavPosRef.current.lng) * Math.PI / 180;
              const a = Math.sin(dLat / 2) ** 2 + Math.cos(lastNavPosRef.current.lat * Math.PI / 180) *
                Math.cos(latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
              const distM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              deltaKmh = (distM / dtS) * 3.6;
            }
          }
          lastNavPosRef.current = { lat: latitude, lng: longitude };
          lastNavTimeRef.current = now;

          // Best speed estimate: blend GPS + delta, prefer delta when GPS is 0/null
          let bestSpeed = null;
          const gpsKmh = speed !== null && speed >= 0 ? Math.round(speed * 3.6) : null;
          if (gpsKmh !== null && deltaKmh !== null) {
            bestSpeed = Math.round(gpsKmh * 0.55 + deltaKmh * 0.45);
          } else if (gpsKmh !== null) {
            bestSpeed = gpsKmh;
          } else if (deltaKmh !== null) {
            bestSpeed = Math.round(deltaKmh);
          }

          setLiveSpeed(bestSpeed);
          mapRef.current?.updateNavPosition(latitude, longitude, heading, bestSpeed);
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
    if (voiceEnabledRef.current) {
      speak('Navigation started.');
      // Announce first step after a short delay
      setTimeout(() => {
        const firstStep = route.steps?.[0];
        if (firstStep && voiceEnabledRef.current) {
          speak(formatNavInstruction(firstStep));
        }
      }, 2800);
    }
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

  const handleLayerChange = useCallback((layer) => setCurrentLayer(layer), []);

  const handleVoiceToggle = useCallback(() => {
    setVoiceEnabled((prev) => {
      if (prev) stopSpeech();
      return !prev;
    });
  }, []);


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
    const s = loadSettings();
    setSettings(s);
    const dark = s.autoDarkMode ? shouldBeDark() : false;
    setIsDark(dark);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (navigator.geolocation) {
      setTimeout(() => handleLocate(), 1000);
    }
    // Pre-load speech synthesis voice list
    ensureVoicesLoaded();
  }, [handleLocate]);

  // Keep voiceEnabledRef in sync for use inside callbacks
  const voiceEnabledRef = useRef(voiceEnabled);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  // Stop speech when navigation ends
  useEffect(() => {
    if (!isNavigating) stopSpeech();
  }, [isNavigating]);

  useEffect(() => {
    document.documentElement.setAttribute('dir', getDirection(lang));
  }, []); // lang is constant 'en'

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

  // Don't render anything until mounted on the client (prevents SSR/extension hydration mismatch)
  if (!mounted) return null;

  return (
    <>
      {/* ===== Navigation HUD ===== */}
      {isNavigating && navRoute && (
        <>
          {/* TOP: Turn card + lane assist + next step */}
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
                  {/* Prefer full English instruction; name is already English-resolved from api.js */}
                  {currentStep?.instruction || currentStep?.name || 'Continue on route'}
                </div>
                {/* Lane markings — Waze style inside the turn card */}
                {navRoute.steps?.[navStepIndex]?.lanes && (
                  <div className="nav-lane-row">
                    {navRoute.steps[navStepIndex].lanes.map((isValid, i) => (
                      <div key={i} className={`nav-lane-mark ${isValid ? 'valid' : 'invalid'}`}>
                        <svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor">
                          <path d="M6 0 L10 8 H7 V20 H5 V8 H2 Z" />
                        </svg>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Next step preview */}
            {nextStep && (
              <div className="nav-next-step">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.65, flexShrink: 0 }}>
                  <path d="M12 20V4M5 11l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="nav-next-step-label">Then</span>
                <span className="nav-next-step-instruction">
                  {nextStep.instruction || nextStep.name}
                </span>
                <span className="nav-next-step-dist">{nextStep.distance}</span>
              </div>
            )}
          </div>

          {/* BOTTOM: ETA bar */}
          <div className="nav-bottom-bar" id="nav-eta-banner">
            <div className="nav-speed-circle">
              <span className="nav-speed-value">{liveSpeed !== null ? liveSpeed : '--'}</span>
              <span className="nav-speed-unit">km/h</span>
            </div>
            <div className="nav-bottom-info">
              <span className="nav-bottom-time">
                {typeof remainingDuration === 'string' ? remainingDuration : navRoute.duration}
              </span>
              <span className="nav-bottom-dot">·</span>
              <span className="nav-bottom-dist">{remainingDistance || navRoute.distance}</span>
              <span className="nav-bottom-dot">·</span>
              <span className="nav-bottom-arrival">{calculateETA(navRoute.rawDuration)}</span>
            </div>
            <button className="nav-end-btn" onClick={handleEndJourney} id="end-nav-btn" aria-label="End navigation">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Re-center button */}
          <button className="nav-recenter-btn" onClick={handleRecenter} title={t.recenter} id="recenter-btn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
            </svg>
          </button>
        </>
      )}

      <MapView
        ref={mapRef}
        onMapClick={handleMapClick}
        onRouteSelect={handleRouteSelect}
        onBearingChange={handleBearingChange}
        onStepChange={handleStepChange}
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

      {/* Full controls column — hidden during navigation to avoid duplicate buttons */}
      {!isNavigating && (
        <MapControls
          onLocate={handleLocate}
          onLayerChange={handleLayerChange}
          currentLayer={currentLayer}
          onSettingsOpen={() => setSettingsOpen(true)}
          bearing={mapBearing}
          onCompassReset={handleCompassReset}
          voiceEnabled={voiceEnabled}
          onVoiceToggle={handleVoiceToggle}
          t={t}
        />
      )}

      {/* Floating compass + voice during navigation — positioned below the blue banner */}
      {isNavigating && (
        <div className="nav-floating-controls">
          <button
            className="nav-compass-btn"
            onClick={handleCompassReset}
            title="Reset north"
            aria-label="Reset north"
            id="nav-compass-btn"
          >
            <svg
              width="28" height="28" viewBox="0 0 28 28"
              style={{ transform: `rotate(${-mapBearing}deg)`, transition: 'transform 0.15s ease', display: 'block' }}
              aria-hidden="true"
            >
              <polygon points="14,3 17,14 14,12 11,14" fill="#ea4335" />
              <polygon points="14,25 17,14 14,16 11,14" fill="#bdc1c6" />
              <circle cx="14" cy="14" r="2.2" fill="rgba(255,255,255,0.7)" />
            </svg>
          </button>
          <button
            className={`nav-compass-btn nav-voice-float ${voiceEnabled ? '' : 'muted'}`}
            onClick={handleVoiceToggle}
            title={voiceEnabled ? 'Mute voice' : 'Unmute voice'}
            aria-label={voiceEnabled ? 'Mute voice' : 'Unmute voice'}
            id="nav-voice-float-btn"
          >
            {voiceEnabled ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.3" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.2" />
                <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>
        </div>
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

      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}
