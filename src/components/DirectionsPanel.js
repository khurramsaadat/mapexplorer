'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { searchPlaces, getDirections } from '@/lib/api';

export default function DirectionsPanel({
    isOpen,
    onClose,
    onRouteFound,
    onClearRoute,
    onStartJourney,
    initialDestination,
    selectedRouteIndex,
    t,
    lang,
}) {
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [originCoords, setOriginCoords] = useState(null);
    const [destCoords, setDestCoords] = useState(null);
    const [mode, setMode] = useState('driving');
    const [routes, setRoutes] = useState(null);
    const [activeRouteIndex, setActiveRouteIndex] = useState(0);
    const [loading, setLoading] = useState(false);

    const [activeInput, setActiveInput] = useState(null);
    const [autoResults, setAutoResults] = useState([]);
    const debounceRef = useRef(null);

    useEffect(() => {
        if (initialDestination && isOpen) {
            setDestination(initialDestination.name);
            setDestCoords({ lat: initialDestination.lat, lon: initialDestination.lon });
        }
    }, [initialDestination, isOpen]);

    // Auto-detect location when directions panel opens
    useEffect(() => {
        if (isOpen && !origin && !originCoords) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        setOrigin(t.yourLocation);
                        setOriginCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                        localStorage.setItem('location_consent', 'granted');
                    },
                    () => { }, // silently fail
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            }
        }
    }, [isOpen, origin, originCoords, t.yourLocation]);

    const handleInputChange = useCallback((field, value) => {
        if (field === 'origin') {
            setOrigin(value);
            setOriginCoords(null);
        } else {
            setDestination(value);
            setDestCoords(null);
        }

        setActiveInput(field);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            if (value.trim().length < 2) {
                setAutoResults([]);
                return;
            }
            const places = await searchPlaces(value, lang);
            setAutoResults(places);
        }, 350);
    }, [lang]);

    const handleAutoSelect = (place) => {
        if (activeInput === 'origin') {
            setOrigin(place.name);
            setOriginCoords({ lat: place.lat, lon: place.lon });
        } else {
            setDestination(place.name);
            setDestCoords({ lat: place.lat, lon: place.lon });
        }
        setAutoResults([]);
        setActiveInput(null);
    };

    const calculateRoute = useCallback(async () => {
        if (!originCoords || !destCoords) return;

        setLoading(true);
        const result = await getDirections(
            originCoords.lat, originCoords.lon,
            destCoords.lat, destCoords.lon,
            mode
        );
        setLoading(false);

        if (result && result.length > 0) {
            setRoutes(result);
            setActiveRouteIndex(0);
            onRouteFound?.(result, 0, originCoords, destCoords, mode);
        } else {
            setRoutes(null);
            onClearRoute?.();
        }
    }, [originCoords, destCoords, mode, onRouteFound, onClearRoute]);

    useEffect(() => {
        calculateRoute();
    }, [calculateRoute]);

    // Sync route selection from map
    useEffect(() => {
        if (selectedRouteIndex !== undefined && selectedRouteIndex !== null && routes && selectedRouteIndex !== activeRouteIndex) {
            setActiveRouteIndex(selectedRouteIndex);
            onRouteFound?.(routes, selectedRouteIndex, originCoords, destCoords, mode);
        }
    }, [selectedRouteIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSwap = () => {
        setOrigin(destination);
        setDestination(origin);
        setOriginCoords(destCoords);
        setDestCoords(originCoords);
    };

    const handleClose = () => {
        setOrigin('');
        setDestination('');
        setOriginCoords(null);
        setDestCoords(null);
        setRoutes(null);
        setAutoResults([]);
        onClearRoute?.();
        onClose?.();
    };

    const handleUseMyLocation = () => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setOrigin(t.yourLocation);
                setOriginCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                localStorage.setItem('location_consent', 'granted');
            },
            () => { }
        );
    };

    return (
        <div className={`directions-panel ${isOpen ? 'open' : ''}`} id="directions-panel">
            <div className="directions-header">
                <button className="back-btn" onClick={handleClose} title={t.close} id="close-directions-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5" />
                        <path d="M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 className="directions-title">{t.directionsTitle}</h2>
            </div>

            <div className="directions-mode-selector">
                {['driving', 'walking', 'cycling'].map((m) => (
                    <button
                        key={m}
                        className={`mode-btn ${mode === m ? 'active' : ''}`}
                        onClick={() => setMode(m)}
                        title={t[m]}
                        id={`mode-${m}`}
                    >
                        {m === 'driving' && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zm10 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM3 9l2-5h14l2 5M3 9v8h2m14-8v8h2M3 9h18" />
                            </svg>
                        )}
                        {m === 'walking' && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="13" cy="4" r="2" />
                                <path d="M10 22l1-7-3-3 4-4 3 5h3" />
                            </svg>
                        )}
                        {m === 'cycling' && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="5.5" cy="17.5" r="3.5" />
                                <circle cx="18.5" cy="17.5" r="3.5" />
                                <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2" />
                            </svg>
                        )}
                    </button>
                ))}
            </div>

            <div className="directions-inputs">
                <div className="input-group">
                    <div className="input-dot origin-dot" />
                    <input
                        type="text"
                        className="directions-input"
                        placeholder={t.chooseOrigin}
                        autoComplete="off"
                        value={origin}
                        onChange={(e) => handleInputChange('origin', e.target.value)}
                        onFocus={() => setActiveInput('origin')}
                        id="origin-input"
                    />
                    <div className="input-connector" />
                </div>

                <div className="input-group">
                    <div className="input-dot destination-dot" />
                    <input
                        type="text"
                        className="directions-input"
                        placeholder={t.chooseDestination}
                        autoComplete="off"
                        value={destination}
                        onChange={(e) => handleInputChange('destination', e.target.value)}
                        onFocus={() => setActiveInput('destination')}
                        id="destination-input"
                    />
                </div>

                {(autoResults.length > 0 || (activeInput === 'origin' && !originCoords)) && (
                    <div className="directions-autocomplete" id="directions-autocomplete">
                        {activeInput === 'origin' && !originCoords && (
                            <div className="search-result-item" onClick={handleUseMyLocation} id="use-my-location">
                                <div className="result-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                                    </svg>
                                </div>
                                <div className="result-info">
                                    <div className="result-name">{t.yourLocation}</div>
                                    <div className="result-address">{t.useGPS}</div>
                                </div>
                            </div>
                        )}
                        {autoResults.map((place) => (
                            <div
                                key={place.id}
                                className="search-result-item"
                                onClick={() => handleAutoSelect(place)}
                            >
                                <div className="result-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                </div>
                                <div className="result-info">
                                    <div className="result-name">{place.name}</div>
                                    <div className="result-address">{place.fullAddress}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="swap-btn-container">
                    <button className="swap-btn" onClick={handleSwap} title={t.swap} id="swap-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                    </button>
                </div>
            </div>

            {loading && (
                <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
                    <div className="loading-spinner" />
                </div>
            )}

            {routes && routes.length > 0 && !loading && (
                <>
                    <div className="route-alternatives-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 20px 20px' }}>
                        <h3 style={{ fontSize: '14px', margin: 0, opacity: 0.8, paddingBottom: '4px' }}>Route Options</h3>
                        {routes.map((r, i) => (
                            <button
                                key={i}
                                className={`route-option-card ${i === activeRouteIndex ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveRouteIndex(i);
                                    onRouteFound?.(routes, i, originCoords, destCoords, mode);
                                }}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    border: i === activeRouteIndex ? '2px solid #4285f4' : '1px solid var(--border)',
                                    background: i === activeRouteIndex ? 'rgba(66, 133, 244, 0.05)' : 'var(--bg-secondary)',
                                    cursor: 'pointer',
                                    width: '100%',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                    boxShadow: i === activeRouteIndex ? '0 2px 8px rgba(66,133,244,0.15)' : 'none'
                                }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: i === activeRouteIndex ? '#1a73e8' : 'var(--text-primary)' }}>
                                        {r.duration}
                                    </span>
                                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                        <span style={{color: '#34a853'}}>Fastest route</span> • {r.distance}
                                    </span>
                                </div>
                                {i === activeRouteIndex && (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="route-summary-action" style={{ padding: '0 20px 20px' }}>
                        <button
                            className="start-journey-btn"
                            id="start-journey-btn"
                            onClick={() => onStartJourney?.(routes[activeRouteIndex])}
                            style={{
                                width: '100%',
                                padding: '14px',
                                fontSize: '16px',
                                borderRadius: '24px',
                                background: '#1a73e8',
                                color: 'white',
                                border: 'none',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                            </svg>
                            {t.startTrip || 'Start your trip'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
