'use client';

import { useState, useEffect } from 'react';

const DEFAULT_SETTINGS = {
    units: 'km',
    avoidTolls: false,
    avoidHighways: false,
    avoidFerries: false,
    defaultMode: 'driving',
    autoDarkMode: true,
    mapAutoRotate: true,
    voiceGuidance: false,
    speedWarning: 120,
};

export function loadSettings() {
    try {
        const saved = localStorage.getItem('map_settings');
        if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) { /* ignore */ }
    return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
    localStorage.setItem('map_settings', JSON.stringify(settings));
}

export default function SettingsPanel({ isOpen, onClose, settings, onSettingsChange, t }) {
    const [local, setLocal] = useState(settings);

    useEffect(() => {
        setLocal(settings);
    }, [settings]);

    const update = (key, value) => {
        const next = { ...local, [key]: value };
        setLocal(next);
        saveSettings(next);
        onSettingsChange?.(next);
    };

    return (
        <div className={`settings-panel ${isOpen ? 'open' : ''}`} id="settings-panel">
            <div className="settings-header">
                <button className="back-btn" onClick={onClose} title={t.close} id="close-settings-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5" />
                        <path d="M12 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 className="settings-title">{t.settings}</h2>
            </div>

            <div className="settings-body">
                {/* Units */}
                <div className="settings-section">
                    <div className="settings-label">{t.units}</div>
                    <div className="settings-toggle-group">
                        <button
                            className={`settings-toggle-btn ${local.units === 'km' ? 'active' : ''}`}
                            onClick={() => update('units', 'km')}
                        >
                            {t.kilometers}
                        </button>
                        <button
                            className={`settings-toggle-btn ${local.units === 'mi' ? 'active' : ''}`}
                            onClick={() => update('units', 'mi')}
                        >
                            {t.miles}
                        </button>
                    </div>
                </div>

                {/* Avoid */}
                <div className="settings-section">
                    <div className="settings-label">{t.avoidTolls}</div>
                    <label className="settings-switch">
                        <input type="checkbox" checked={local.avoidTolls} onChange={(e) => update('avoidTolls', e.target.checked)} />
                        <span className="settings-slider" />
                    </label>
                </div>

                <div className="settings-section">
                    <div className="settings-label">{t.avoidHighways}</div>
                    <label className="settings-switch">
                        <input type="checkbox" checked={local.avoidHighways} onChange={(e) => update('avoidHighways', e.target.checked)} />
                        <span className="settings-slider" />
                    </label>
                </div>

                <div className="settings-section">
                    <div className="settings-label">{t.avoidFerries}</div>
                    <label className="settings-switch">
                        <input type="checkbox" checked={local.avoidFerries} onChange={(e) => update('avoidFerries', e.target.checked)} />
                        <span className="settings-slider" />
                    </label>
                </div>

                {/* Default travel mode */}
                <div className="settings-section">
                    <div className="settings-label">{t.defaultMode}</div>
                    <div className="settings-toggle-group">
                        {['driving', 'walking', 'cycling'].map((m) => (
                            <button
                                key={m}
                                className={`settings-toggle-btn ${local.defaultMode === m ? 'active' : ''}`}
                                onClick={() => update('defaultMode', m)}
                            >
                                {t[m]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Auto dark mode */}
                <div className="settings-section">
                    <div className="settings-label">{t.autoDarkMode}</div>
                    <label className="settings-switch">
                        <input type="checkbox" checked={local.autoDarkMode} onChange={(e) => update('autoDarkMode', e.target.checked)} />
                        <span className="settings-slider" />
                    </label>
                </div>

                {/* Map auto-rotate */}
                <div className="settings-section">
                    <div className="settings-label">{t.mapAutoRotate}</div>
                    <label className="settings-switch">
                        <input type="checkbox" checked={local.mapAutoRotate} onChange={(e) => update('mapAutoRotate', e.target.checked)} />
                        <span className="settings-slider" />
                    </label>
                </div>

                {/* Voice guidance */}
                <div className="settings-section">
                    <div className="settings-label">{t.voiceGuidance}</div>
                    <label className="settings-switch">
                        <input type="checkbox" checked={local.voiceGuidance} onChange={(e) => update('voiceGuidance', e.target.checked)} />
                        <span className="settings-slider" />
                    </label>
                </div>

                {/* Speed warning */}
                <div className="settings-section">
                    <div className="settings-label">{t.speedWarning}</div>
                    <input
                        type="number"
                        className="settings-number-input"
                        value={local.speedWarning}
                        onChange={(e) => update('speedWarning', parseInt(e.target.value) || 0)}
                        min="0"
                        max="300"
                    />
                </div>
            </div>
        </div>
    );
}
