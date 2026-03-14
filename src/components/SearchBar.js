'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { searchPlaces } from '@/lib/api';

export default function SearchBar({ onPlaceSelect, onDirectionsOpen, t, lang }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const debounceRef = useRef(null);
    const inputRef = useRef(null);

    const handleSearch = useCallback(async (value) => {
        if (value.trim().length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        const places = await searchPlaces(value, lang);
        setResults(places);
        setIsOpen(places.length > 0);
    }, [lang]);

    const handleInputChange = (e) => {
        const value = e.target.value;
        setQuery(value);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => handleSearch(value), 350);
    };

    const handleSelect = (place) => {
        setQuery(place.name);
        setResults([]);
        setIsOpen(false);
        onPlaceSelect?.(place);
    };

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    useEffect(() => {
        const handleClick = (e) => {
            if (!e.target.closest('.search-container')) {
                setIsOpen(false);
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    return (
        <div className="search-container">
            <div className="search-bar">
                <button className="search-icon-btn" title="Search">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </button>

                <input
                    ref={inputRef}
                    type="text"
                    className="search-input"
                    placeholder={t.searchPlaceholder}
                    autoComplete="off"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => results.length > 0 && setIsOpen(true)}
                    id="search-input"
                />

                {query && (
                    <button className="search-icon-btn" title={t.clear} onClick={handleClear}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}

                <button
                    className="search-icon-btn"
                    title={t.directions}
                    onClick={() => onDirectionsOpen?.()}
                    id="directions-btn"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                </button>
            </div>

            {isOpen && results.length > 0 && (
                <div className="search-results" id="search-results">
                    {results.map((place) => (
                        <div
                            key={place.id}
                            className="search-result-item"
                            onClick={() => handleSelect(place)}
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
        </div>
    );
}
