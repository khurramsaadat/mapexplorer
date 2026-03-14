'use client';

import { useState, useEffect, useRef } from 'react';

export default function MapControls({
    onLocate,
    onLayerChange,
    currentLayer,
    onThemeToggle,
    isDark,
    onZoomIn,
    onZoomOut,
    lang,
    onLangToggle,
    isFullscreen,
    onFullscreenToggle,
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

    return (
        <>
            {/* Zoom */}
            <div className="zoom-controls">
                <button className="zoom-btn" onClick={onZoomIn} title={t.zoomIn} aria-label={t.zoomIn} id="zoom-in-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
                <button className="zoom-btn" onClick={onZoomOut} title={t.zoomOut} aria-label={t.zoomOut} id="zoom-out-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </div>

            {/* Controls */}
            <div className="map-controls">
                {/* Waze-style Report Button */}
                <button 
                    className="map-control-btn report-btn" 
                    onClick={() => { alert(t.reportHazard || 'Report feature coming soon!'); }} 
                    title={t.reportHazard || 'Report'} 
                    aria-label={t.reportHazard || 'Report'}
                    id="report-btn"
                    style={{ background: 'var(--orange)', color: 'white', border: 'none', marginBottom: '8px' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </button>

                <button className="map-control-btn" onClick={onLocate} title={t.myLocation} aria-label={t.myLocation} id="locate-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                    </svg>
                </button>

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

                <button className="map-control-btn" onClick={onThemeToggle} title={t.darkMode} aria-label={t.darkMode} id="theme-btn">
                    {isDark ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5" />
                            <line x1="12" y1="1" x2="12" y2="3" />
                            <line x1="12" y1="21" x2="12" y2="23" />
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                            <line x1="1" y1="12" x2="3" y2="12" />
                            <line x1="21" y1="12" x2="23" y2="12" />
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                    )}
                </button>

                {/* Language Toggle */}
                <button
                    className="map-control-btn"
                    onClick={onLangToggle}
                    title={t.languageLabel}
                    aria-label={t.languageLabel}
                    id="lang-btn"
                    style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}
                >
                    {t.language}
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
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="8 3 8 8 3 8" />
                            <polyline points="16 3 16 8 21 8" />
                            <polyline points="8 21 8 16 3 16" />
                            <polyline points="16 21 16 16 21 16" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                        {['streets', 'satellite', 'terrain', 'dark'].map((layer) => (
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
