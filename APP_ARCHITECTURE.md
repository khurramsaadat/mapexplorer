# Map Explorer - Application Architecture & Documentation

## Overview
Map Explorer is a web-based navigation application built with React, Next.js, and MapLibre GL JS. It aims to provide a Google Maps/Waze-like experience with features including location search, route planning (driving, walking, cycling), visual route selection, active navigation with live UI, and customizable user settings.

## Technology Stack
- **Framework:** Next.js (App Router), React
- **Map Rendering:** MapLibre GL JS (`maplibre-gl`)
- **Map Tiles:** OpenFreeMap (Streets) and Esri/ArcGIS (Satellite) via [src/lib/tiles.js](file:///c:/Data/apps/antigravity/google-maps/src/lib/tiles.js)
- **Geocoding API:** Nominatim (OpenStreetMap)
- **Routing Engine:** OSRM (via communal `routing.openstreetmap.de` endpoints for specialized foot/bike/car support)
- **Styling:** Vanilla CSS ([globals.css](file:///c:/Data/apps/antigravity/google-maps/src/app/globals.css)) with CSS variables and theming support

## Core Components

### 1. [src/app/page.js](file:///c:/Data/apps/antigravity/google-maps/src/app/page.js) (Main Controller)
The root component that orchestrates the entire application state.
- **State Management:** Manages UI visibility (Directions, Settings), current selected location, navigation state (`isNavigating`, `navRoute`), live GPS speed, and ETA.
- **Dynamic Import:** `MapView` is loaded dynamically avoiding SSR issues since `maplibre-gl` requires the `window` object.
- **Navigation Flow:** Handles starting (`handleStartJourney`) and ending (`handleEndJourney`) a trip, tracking the user via `navigator.geolocation.watchPosition`, and rendering the Navigation HUD (ETA banner, current step, lane assist).

### 2. [src/components/MapView.js](file:///c:/Data/apps/antigravity/google-maps/src/components/MapView.js) (Map Rendering)
A wrapper around the MapLibre map instance exposing methods to the parent via `useImperativeHandle`.
- **Initialization:** Reads last center/zoom from `localStorage`. Applies [applyStyleTweaks](file:///c:/Data/apps/antigravity/google-maps/src/components/MapView.js#9-42) to remove text halos and adjust POI visibility.
- **Markers:** Exposes [addMarker](file:///c:/Data/apps/antigravity/google-maps/src/components/MapView.js#191-207), [clearMarkers](file:///c:/Data/apps/antigravity/google-maps/src/components/MapView.js#208-212).
- **Routes:** [drawRoutes(routes, activeIndex, ...)](file:///c:/Data/apps/antigravity/google-maps/src/components/MapView.js#218-376) renders all alternative route options as GeoJSON lines. Inactive routes are semi-transparent and clickable. Active routes include a simulated traffic coloring layer. Route duration labels are added as HTML markers on the lines.
- **Navigation UI:** [startNavigation](file:///c:/Data/apps/antigravity/google-maps/src/components/MapView.js#400-448) creates a custom blue SVG arrow marker. [updateNavPosition](file:///c:/Data/apps/antigravity/google-maps/src/components/MapView.js#449-470) rotates the arrow via device heading and implements auto-follow (`easeTo`).
- **User Location:** [locateUser](file:///c:/Data/apps/antigravity/google-maps/src/components/MapView.js#494-558) finds GPS and drops an accuracy circle.

### 3. [src/components/SearchBar.js](file:///c:/Data/apps/antigravity/google-maps/src/components/SearchBar.js)
Handles user input for looking up places.
- **Search:** Uses debounced input hitting Nominatim API.
- **History:** Saves past searches to `localStorage`.

### 4. [src/components/DirectionsPanel.js](file:///c:/Data/apps/antigravity/google-maps/src/components/DirectionsPanel.js) (Route Preview)
The overlay responsible for showing route options *before* starting a trip.
- **Inputs:** Origin (auto-detects if empty) and Destination.
- **Calculation:** Calls [api.js](file:///c:/Data/apps/antigravity/google-maps/src/lib/api.js) [getDirections](file:///c:/Data/apps/antigravity/google-maps/src/lib/api.js#163-248).
- **Route Options UI:** Renders the route alternatives as large vertical cards (showing duration, distance, and "Fastest route" tag) directly in the panel. Updates the map immediately when a card is tapped.
- **No Steps in Preview:** Turn-by-turn steps are intentionally omitted from this panel to keep the focus purely on selecting the best route before pressing "Start your trip".

### 5. [src/components/SettingsPanel.js](file:///c:/Data/apps/antigravity/google-maps/src/components/SettingsPanel.js)
A configurable slide-out panel allowing the user to mutate app behavior.
- **Settings:** Units (km/mi), Avoids (tolls/highways/ferries), Default mode, Auto Dark Mode, Map Auto-Rotate, Voice Guidance, Speed Warnings.
- **Persistence:** Immediately syncs state to `localStorage` via `map_settings` key.

### 6. [src/components/MapControls.js](file:///c:/Data/apps/antigravity/google-maps/src/components/MapControls.js) & [src/components/PlaceCard.js](file:///c:/Data/apps/antigravity/google-maps/src/components/PlaceCard.js)
- **MapControls:** Floating buttons on the right for Locate, Layers (Streets/Satellite), Language, Settings Cog, and Fullscreen.
- **PlaceCard:** Bottom sheet displaying place details (Name, Address, Coordinates, Wikipedia description) when a location is selected from search or tapped on the map. Contains the "Directions" action button.

## APIs ([src/lib/api.js](file:///c:/Data/apps/antigravity/google-maps/src/lib/api.js))
- [searchPlaces(query, lang)](file:///c:/Data/apps/antigravity/google-maps/src/lib/api.js#12-80): Uses Nominatim with `limit=8`, `addressdetails=1`. Biased locally using `viewbox` (Dubai coordinates), `bounded='0'`, and `countrycodes='ae'` to ensure local POIs are strictly prioritized over global results. Background asynchronous fetches obtain Wikipedia thumbnails/descriptions for rich cards without blocking the search.
- [reverseGeocode(lat, lon)](file:///c:/Data/apps/antigravity/google-maps/src/lib/api.js#109-162): Converts map clicks back to addresses via Nominatim.
- [getDirections(startLat, startLon, endLat, endLon, mode, numAlternatives)](file:///c:/Data/apps/antigravity/google-maps/src/lib/api.js#163-248): Hits the `routing.openstreetmap.de` OSRM endpoints (`routed-car`, `routed-foot`, `routed-bike`). Unlike the generic demo server, these specialized instances are better at returning multiple (up to 3) route alternatives for all transportation modes. Returns GeoJSON line strings along with turn-by-turn steps and Lane Assist indicators.

## Internationalization ([src/lib/i18n.js](file:///c:/Data/apps/antigravity/google-maps/src/lib/i18n.js))
- Supports English ([en](file:///c:/Data/apps/antigravity/google-maps/src/components/MapView.js#486-493)) and Arabic ([ar](file:///c:/Data/apps/antigravity/google-maps/src/components/SearchBar.js#6-178)). 
- Provides the static dictionary for all strings in the UI. 
- Automatically sets HTML `dir="rtl"` when Arabic is active.
- Dictates [shouldBeDark()](file:///c:/Data/apps/antigravity/google-maps/src/lib/i18n.js#1-9) check depending on local time.

## Mobile UI Redesign (compact bottom-sheet)
- **70/30 Screen Split**: On narrow viewports (<= 768px), the MapView occupies the top 70% of the screen while the DirectionsPanel or PlaceCard occupies the bottom 30% as a responsive bottom-sheet.
- **Vertical Compaction**: Styles for headers, inputs, and list items are compressed on mobile to ensure the "Start your trip" button remains visible within the 30vh constraint.
- **Touch Optimization**: Zoom buttons are hidden on mobile to maximize map real estate, leveraging native pinch-to-zoom.

## Startup & Location Optimization
- **Quick Locate**: The app triggers an automatic `handleLocate` call 1 second after mount to center the map on the user's GPS position immediately.
- **Initialization Stabilizing**: Callback hooks are defined before effects in [page.js](file:///c:/Data/apps/antigravity/google-maps/src/app/page.js) to ensure reliable component mounting without ReferenceErrors.

## Key CSS ([src/app/globals.css](file:///c:/Data/apps/antigravity/google-maps/src/app/globals.css))
- Contains all variables (`--bg-primary`, `--accent`, etc.) supporting `data-theme="dark"` and `light`.
- Complex navigation styles include: `.nav-eta-banner`, `.nav-step-banner`, `.route-label`, `.nav-arrow-container`, `.nav-recenter-btn`.

## Recent Updates & Future AI Reference
- **Search Context:** Nominatim must use `countrycodes=ae` if prioritizing UAE/Dubai search queries to prevent phonetic matches linking to countries like Lebanon.
- **Route Preview UI:** `directions-steps` (turn-by-turn) are kept explicitly hidden until the user clicks `onStartJourney` to avoid confusion between "Planning" and "Active Navigation". Route options must be clearly presented alongside the main "Start" action button.
- **Limitations:** OSRM's public demo API does not provide genuine live traffic congestion data; traffic colors are simulated procedurally along the route geometry based on weight vs. geometric variation.
