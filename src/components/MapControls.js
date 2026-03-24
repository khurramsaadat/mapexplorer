'use client';

import { useState, useEffect, useRef } from 'react';

// Google Maps compass SVG — red N arrow, grey S
function CompassSVG({ bearing = 0 }) {
    return (
        <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 0.15s ease', display: 'block' }}
            aria-hidden="true"
        >
            {/* North arrow — red */}
            <polygon points="14,3 17,14 14,12 11,14" fill="#ea4335" />
            {/* South arrow — light grey */}
            <polygon points="14,25 17,14 14,16 11,14" fill="#bdc1c6" />
            {/* Center dot */}
            <circle cx="14" cy="14" r="2.2" fill="#5f6368" />
        </svg>
    );
}

export default function MapControls({
    onLocate,
    onLayerChange,
    currentLayer,
    onZoomIn,
    onZoomOut,
    lang,
    onLangToggle,
    isFullscreen,
    onFullscreenToggle,
    onSettingsOpen,
    bearing = 0,
    onCompassReset,
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
            {/* Zoom */}
            <div className="zoom-controls">
                <button className="zoom-btn" onClick={onZoomIn} title={t.zoomIn} aria-label={t.zoomIn} id="zoom-in-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
                <button className="zoom-btn" onClick={onZoomOut} title={t.zoomOut} aria-label={t.zoomOut} id="zoom-out-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
            </div>

            {/* Controls */}
            <div className="map-controls">
                {/* Compass — always visible, above locate, red N */}
                <button
                    className={`map-control-btn compass-btn ${isRotated ? 'rotated' : ''}`}
                    onClick={onCompassReset}
                    title="Reset north"
                    aria-label="Reset north"
                    id="compass-btn"
                >
                    <CompassSVG bearing={bearing} />
                </button>

                {/* My Location — Google Maps blue */}
                <button className="map-control-btn locate-btn" onClick={onLocate} title={t.myLocation} aria-label={t.myLocation} id="locate-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" fill="#4285f4" stroke="#4285f4" />
                        <path d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke="#4285f4" />
                    </svg>
                </button>

                {/* Layers */}
                <button
                    className={`map-control-btn ${showLayers ? 'active' : ''}`}
                    id="layers-btn"
                    onClick={() => setShowLayers(!showLayers)}
                    title={t.mapLayers}
                    aria-label={t.mapLayers}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2">
                        <polygon points="12 2 2 7 12 12 22 7 12 2" />
                        <polyline points="2 17 12 22 22 17" />
                        <polyline points="2 12 12 17 22 12" />
                    </svg>
                </button>

                {/* Language Toggle */}
                <button
                    className="map-control-btn"
                    onClick={onLangToggle}
                    title={t.languageLabel}
                    aria-label={t.languageLabel}
                    id="lang-btn"
                    style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif', color: '#5f6368' }}
                >
                    {t.language}
                </button>

                {/* Settings */}
                <button
                    className="map-control-btn"
                    onClick={onSettingsOpen}
                    title={t.settings}
                    aria-label={t.settings}
                    id="settings-btn"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                </button>

                {/* Fullscreen Toggle */}
                <button
                    className="map-control-btn"
                    onClick={onFullscreenToggle}
                    title={isFullscreen ? t.exitFullScreen : t.fullScreen}
                    aria-label={isFullscreen ? t.exitFullScreen : t.fullScreen}
                    id="fullscreen-btn"
                >
                    {isFullscreen ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2">
                            <polyline points="8 3 8 8 3 8" />
                            <polyline points="16 3 16 8 21 8" />
                            <polyline points="8 21 8 16 3 16" />
                            <polyline points="16 21 16 16 21 16" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2">
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                    )}
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
