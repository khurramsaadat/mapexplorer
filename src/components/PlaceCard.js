'use client';
import { useState } from 'react';

export default function PlaceCard({ place, onClose, onDirections, onStart, t }) {
    const [activeTab, setActiveTab] = useState('overview');
    if (!place) return null;

    const wiki = place.wikiData;
    const extra = place.extratags || {};

    const phone = extra.phone || extra['contact:phone'];
    const website = extra.website || extra['contact:website'];
    const openingHours = extra.opening_hours;
    const categoryName = place.type ? place.type.replace('_', ' ') : 'Place';

    return (
        <div className="place-card" id="place-card">
            <button className="place-card-close" onClick={onClose} id="close-place-card">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>

            {wiki?.thumbnail && (
                <div className="place-card-image-bg" style={{ backgroundImage: `url(${wiki.thumbnail})` }}>
                    <div className="place-card-image-overlay">
                        <button className="photos-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '6px'}}>
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                            </svg>
                            See photos
                        </button>
                    </div>
                </div>
            )}

            <div className="place-card-content">
                <h2 className="place-card-title">{place.name}</h2>
                <div className="place-card-subtitle">
                    <span className="place-rating">4.6 <span className="stars">★★★★<span className="star-half">★</span></span> (109,415)</span>
                </div>
                <div className="place-category">{categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} • <span style={{color: 'var(--accent)'}}>♿</span></div>

                <div className="place-tabs">
                    <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                    <button className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>Reviews</button>
                    <button className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>About</button>
                </div>

                <div className="place-actions-row">
                    <button className="place-action-pill primary" onClick={() => onDirections?.(place)} id="directions-to-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="3 11 22 2 13 21 11 13 3 11" />
                        </svg>
                        <span>Directions</span>
                    </button>
                    <button className="place-action-pill secondary" onClick={() => onStart?.(place)} id="start-to-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                        </svg>
                        <span>Start</span>
                    </button>
                    <button className="place-action-pill tertiary" title="Directory">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                           <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                           <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                        <span>Directory</span>
                    </button>
                    <button className="place-action-pill tertiary" title="Share">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="18" cy="5" r="3" />
                            <circle cx="6" cy="12" r="3" />
                            <circle cx="18" cy="19" r="3" />
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                        <span>Share</span>
                    </button>
                </div>

                <div className="place-details-list">
                    {wiki?.description && (
                        <div className="detail-item wiki-desc">
                            <span>{wiki.description}</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    )}
                    
                    <div className="detail-item">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{place.fullAddress}</span>
                    </div>

                    {website && (
                        <div className="detail-item">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="2" y1="12" x2="22" y2="12"></line>
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                            </svg>
                            <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noreferrer" style={{color: 'var(--text-primary)', textDecoration: 'none'}}>{website.replace(/^https?:\/\//, '')}</a>
                        </div>
                    )}

                    {phone && (
                        <div className="detail-item">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                            <span>{phone}</span>
                        </div>
                    )}

                    {openingHours && (
                        <div className="detail-item">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            <span>Open: {openingHours}</span>
                        </div>
                    )}

                    <div className="detail-item">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        </svg>
                        <span>{place.lat.toFixed(5)}, {place.lon.toFixed(5)}</span>
                    </div>

                    <div className="detail-item">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                        <span>Claim this business</span>
                    </div>

                    <div className="detail-item">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span>Your Maps history</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
