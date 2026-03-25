'use client';

import { useState, useEffect, useRef } from 'react';

// Google Maps compass — red N, grey S
function CompassSVG({ bearing = 0 }) {
    return (
        <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 0.15s ease', display: 'block' }}
            aria-hidden="true"
        >
            <polygon points="14,3 17,14 14,12 11,14" fill="#ea4335" />
            <polygon points="14,25 17,14 14,16 11,14" fill="#bdc1c6" />
            <circle cx="14" cy="14" r="2.2" fill="rgba(255,255,255,0.7)" />
        </svg>
    );
}

// Speaker icon — filled when voice on, strikethrough when muted
function SpeakerSVG({ muted }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {muted ? (
                <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" fill="currentColor" fillOpacity="0.25" />
                    <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" />
                    <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" />
                </>
            ) : (
                <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" fill="currentColor" fillOpacity="0.25" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" />
                </>
            )}
        </svg>
    );
}

export default function MapControls({
    onLocate,
    onLayerChange,
    currentLayer,
    onSettingsOpen,
    bearing = 0,
    onCompassReset,
    voiceEnabled = true,
    onVoiceToggle,
    t,
}) {
    const [showLayers, setShowLayers] = useState(false);
    const layersRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (layersRef.current && !layersRef.current.contains(e.target) && !e.target.closest('#layers-btn')) {
                setShowLayers(false);
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    const isRotated = Math.abs(bearing) > 1;

    return (
        <>
            {/* Controls column */}
            <div className="map-controls">
                {/* Compass — always visible, above locate */}
                <button
                    className={`map-control-btn compass-btn ${isRotated ? 'rotated' : ''}`}
                    onClick={onCompassReset}
                    title="Reset north"
                    aria-label="Reset north"
                    id="compass-btn"
                >
                    <CompassSVG bearing={bearing} />
                </button>

                {/* My Location — concentric rings + dot (GPS target) */}
                <button
                    className="map-control-btn locate-btn"
                    onClick={onLocate}
                    title={t.myLocation}
                    aria-label={t.myLocation}
                    id="locate-btn"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        {/* Outer ring */}
                        <circle cx="12" cy="12" r="9" stroke="#4285f4" strokeWidth="1.5" />
                        {/* Middle ring */}
                        <circle cx="12" cy="12" r="5.5" stroke="#4285f4" strokeWidth="1.5" />
                        {/* Filled center dot */}
                        <circle cx="12" cy="12" r="2.5" fill="#4285f4" />
                    </svg>
                </button>

                {/* Voice toggle */}
                <button
                    className={`map-control-btn voice-btn ${voiceEnabled ? '' : 'muted'}`}
                    onClick={onVoiceToggle}
                    title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
                    aria-label={voiceEnabled ? 'Mute voice navigation' : 'Enable voice navigation'}
                    id="voice-btn"
                >
                    <SpeakerSVG muted={!voiceEnabled} />
                </button>

                {/* Layers */}
                <button
                    className={`map-control-btn ${showLayers ? 'active' : ''}`}
                    id="layers-btn"
                    onClick={() => setShowLayers(!showLayers)}
                    title={t.mapLayers}
                    aria-label={t.mapLayers}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 2 7 12 12 22 7 12 2" />
                        <polyline points="2 17 12 22 22 17" />
                        <polyline points="2 12 12 17 22 12" />
                    </svg>
                </button>

                {/* Settings */}
                <button
                    className="map-control-btn"
                    onClick={onSettingsOpen}
                    title={t.settings}
                    aria-label={t.settings}
                    id="settings-btn"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </button>

            </div>

            {/* Layers Popup */}
            {showLayers && (
                <div className="layers-popup" ref={layersRef} id="layers-popup">
                    <h3 className="layers-title">{t.mapType}</h3>
                    <div className="layers-grid">
                        {['streets', 'satellite'].map((layer) => (
                            <button
                                key={layer}
                                className={`layer-option ${currentLayer === layer ? 'active' : ''}`}
                                onClick={() => {
                                    onLayerChange?.(layer);
                                    setShowLayers(false);
                                }}
                                id={`layer-${layer}`}
                            >
                                <div className={`layer-preview ${layer}-preview`} />
                                <span>{t[layer]}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
