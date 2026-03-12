'use client';

export default function PlaceCard({ place, onClose, onDirections, t }) {
    if (!place) return null;

    return (
        <div className="place-card" id="place-card">
            <button className="place-card-close" onClick={onClose} id="close-place-card">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>

            <h3 className="place-card-title">{place.name}</h3>
            <p className="place-card-address">{place.fullAddress}</p>
            <p className="place-card-coords">
                {place.lat.toFixed(5)}, {place.lon.toFixed(5)}
            </p>

            <div className="place-card-actions">
                <button className="place-action-btn" onClick={() => onDirections?.(place)} id="directions-to-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    {t.directions}
                </button>
                <button
                    className="place-action-btn"
                    id="share-btn"
                    onClick={() => {
                        const url = `https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=17/${place.lat}/${place.lon}`;
                        navigator.clipboard?.writeText(url);
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    {t.share}
                </button>
            </div>
        </div>
    );
}
