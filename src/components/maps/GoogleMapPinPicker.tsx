/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  Map as GoogleMapView,
  Pin,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
  type MapMouseEvent,
} from '@vis.gl/react-google-maps';
import { Crosshair, Loader2, MapPin, RotateCcw, Search, Shield, X } from 'lucide-react';
import { normalizePinnedCoordinates } from '../../utils/civicRules';

const DEFAULT_UTTARAKHAND_CENTER = { lat: 30.3165, lng: 78.0322 };

interface GoogleMapPinPickerProps {
  lat: string;
  lng: string;
  suggestedCenter: { lat: number; lng: number } | null;
  onChange: (lat: string, lng: string) => void;
  error?: string;
}

function dispatchQuotaEventIfApplicable(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('QuotaExceeded') ||
    msg.includes('QUOTA')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

interface ViewportSyncProps {
  pinPosition: { lat: number; lng: number } | null;
  suggestedCenter: { lat: number; lng: number } | null;
  focusNonce: number;
}

function MapViewportSync({ pinPosition, suggestedCenter, focusNonce }: ViewportSyncProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || focusNonce === 0 || !pinPosition) return;
    map.panTo(pinPosition);
    const currentZoom = map.getZoom();
    if (typeof currentZoom !== 'number' || currentZoom < 15) {
      map.setZoom(15);
    }
  }, [map, focusNonce, pinPosition]);

  useEffect(() => {
    if (!map || pinPosition || !suggestedCenter) return;
    map.panTo(suggestedCenter);
    map.setZoom(12);
  }, [map, pinPosition, suggestedCenter]);

  return null;
}

interface PlaceSearchProps {
  suggestedCenter: { lat: number; lng: number } | null;
  onPlaceCoordinates: (lat: number, lng: number, label: string) => void;
}

function GoogleMapsPlaceSearch({ suggestedCenter, onPlaceCoordinates }: PlaceSearchProps) {
  const placesLib = useMapsLibrary('places');
  const status = useApiLoadingStatus();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!placesLib || status !== APILoadingStatus.LOADED || trimmed.length < 2) {
      if (trimmed.length < 2 && suggestions.length > 0) {
        setSuggestions([]);
      }
      return;
    }

    const timer = window.setTimeout(() => {
      const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }

      const biasCenter = suggestedCenter || DEFAULT_UTTARAKHAND_CENTER;
      const request: google.maps.places.AutocompleteRequest = {
        input: trimmed,
        sessionToken: sessionTokenRef.current,
        includedRegionCodes: ['in'],
        locationBias: {
          center: biasCenter,
          radius: 50000,
        },
      };

      setSearching(true);
      setSearchError(null);
      AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
        .then((res) => {
          setSuggestions(res.suggestions || []);
        })
        .catch((err: unknown) => {
          dispatchQuotaEventIfApplicable(err);
          setSuggestions([]);
          setSearchError('Map place search is temporarily unavailable. You can still tap the map directly.');
        })
        .finally(() => {
          setSearching(false);
        });
    }, 240);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesLib, status, query, suggestedCenter]);

  const handleSelectSuggestion = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      setSearching(true);
      setSearchError(null);
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location'],
      });
      const loc = place.location;
      if (!loc) {
        setSearchError('Could not resolve coordinates for that place. Try a nearby landmark or tap the map.');
        return;
      }
      const label = place.displayName || place.formattedAddress || suggestion.placePrediction.text.text;
      setSelectedLabel(label);
      setQuery('');
      resetSession();
      onPlaceCoordinates(loc.lat(), loc.lng(), label);
    } catch (err) {
      dispatchQuotaEventIfApplicable(err);
      setSearchError('Could not load details for the selected place. Tap the map directly to place your pin.');
    } finally {
      setSearching(false);
    }
  };

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search
          className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          role="searchbox"
          aria-label="Search Uttarakhand village, landmark, or road on Google Maps"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any Uttarakhand village, road, or landmark on Google Maps..."
          className="w-full rounded-lg border border-[#E2E6EC] bg-white pl-8 pr-8 py-2 text-xs sm:text-sm text-[#111827] placeholder:text-[#6B7280]"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              resetSession();
            }}
            aria-label="Clear Google Maps search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111827]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {searching && query.trim().length >= 2 && (
        <p className="text-xs text-[#6B7280] flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin text-[#0D7A6F]" aria-hidden="true" />
          <span>Searching Google Maps...</span>
        </p>
      )}

      {suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Google Maps place suggestions"
          className="rounded-lg border border-[#E2E6EC] bg-white shadow-sm max-h-52 overflow-y-auto divide-y divide-[#E2E6EC]"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.placePrediction?.placeId || index}>
              <button
                type="button"
                onClick={() => void handleSelectSuggestion(suggestion)}
                className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs text-[#0F2942] hover:bg-[#F7F6F2] transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-[#0D7A6F] shrink-0 mt-0.5" aria-hidden="true" />
                <span>{suggestion.placePrediction?.text.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedLabel && !query && (
        <p className="text-xs text-[#0D7A6F]">
          Map jumped to <strong>{selectedLabel}</strong> — tap or drag the pin if needed.
        </p>
      )}

      {searchError && (
        <p role="status" className="text-xs text-amber-800">
          {searchError}
        </p>
      )}
    </div>
  );
}

interface MapCanvasProps {
  pinPosition: { lat: number; lng: number } | null;
  suggestedCenter: { lat: number; lng: number } | null;
  focusNonce: number;
  onMapClick: (lat: number, lng: number) => void;
  onMarkerDragEnd: (lat: number, lng: number) => void;
}

function InteractivePinMapCanvas({
  pinPosition,
  suggestedCenter,
  focusNonce,
  onMapClick,
  onMarkerDragEnd,
}: MapCanvasProps) {
  const status = useApiLoadingStatus();
  const initialCenter = useMemo(
    () => pinPosition || suggestedCenter || DEFAULT_UTTARAKHAND_CENTER,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const initialZoom = pinPosition ? 15 : suggestedCenter ? 12 : 9;

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="flex h-72 sm:h-80 w-full flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50/70 px-6 text-center">
        <MapPin className="w-6 h-6 text-amber-800 mb-2" aria-hidden="true" />
        <p className="text-sm font-semibold text-[#0F2942]">Interactive map preview is temporarily unavailable</p>
        <p className="mt-1 max-w-md text-xs text-[#4B5563]">
          You can still use <strong>Pin My Current Location</strong> above to attach your live GPS pin, or skip this
          optional step and submit using your selected Uttarakhand district and locality.
        </p>
      </div>
    );
  }

  const handleClick = (event: MapMouseEvent) => {
    const coords = event.detail.latLng;
    if (!coords) return;
    onMapClick(coords.lat, coords.lng);
  };

  const handleDragEnd = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    onMarkerDragEnd(event.latLng.lat(), event.latLng.lng());
  };

  return (
    <div className="relative h-72 sm:h-80 w-full overflow-hidden rounded-xl border border-[#CBD5E1] bg-[#EEF2F6]">
      {(status === APILoadingStatus.NOT_LOADED || status === APILoadingStatus.LOADING) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F7F6F2]/90 text-xs font-medium text-[#0F2942]">
          <Loader2 className="w-4 h-4 mr-2 animate-spin text-[#0D7A6F]" aria-hidden="true" />
          Loading Google Map...
        </div>
      )}

      <GoogleMapView
        mapId="DEMO_MAP_ID"
        defaultCenter={initialCenter}
        defaultZoom={initialZoom}
        gestureHandling="greedy"
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={true}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        onClick={handleClick}
        className="h-full w-full"
      >
        <MapViewportSync
          pinPosition={pinPosition}
          suggestedCenter={suggestedCenter}
          focusNonce={focusNonce}
        />
        {pinPosition && (
          <AdvancedMarker
            position={pinPosition}
            draggable
            onDragEnd={handleDragEnd}
            title="Pinned problem location (drag to adjust)"
          >
            <Pin background="#0D7A6F" borderColor="#0F2942" glyphColor="#FFFFFF" />
          </AdvancedMarker>
        )}
      </GoogleMapView>
    </div>
  );
}

export function GoogleMapPinPicker({
  lat,
  lng,
  suggestedCenter,
  onChange,
  error,
}: GoogleMapPinPickerProps) {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const [locating, setLocating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);

  const pinPosition = useMemo(() => {
    if (!lat || !lng) return null;
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
    return { lat: parsedLat, lng: parsedLng };
  }, [lat, lng]);

  const applyCoordinates = (rawLat: number, rawLng: number, shouldFocusMap = false) => {
    const normalized = normalizePinnedCoordinates(rawLat, rawLng);
    if (!normalized.valid) {
      setLocalError(normalized.error || 'Pinned location must fall within India.');
      return;
    }
    setLocalError(null);
    onChange(normalized.lat, normalized.lng);
    if (shouldFocusMap) {
      setFocusNonce((n) => n + 1);
    }
  };

  const handlePinCurrentLocation = () => {
    setLocalError(null);
    if (!navigator.geolocation) {
      setLocalError('Device GPS location is not supported in this browser. Tap the map to drop a pin manually.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        applyCoordinates(position.coords.latitude, position.coords.longitude, true);
      },
      (geoError) => {
        setLocating(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setLocalError('Location permission was declined. You can tap anywhere on the map to pin the problem spot instead.');
        } else if (geoError.code === geoError.TIMEOUT) {
          setLocalError('GPS location request timed out. Try again or tap the map to place your pin.');
        } else {
          setLocalError('Could not detect your current GPS position. Tap the map to place a pin manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleClearPin = () => {
    setLocalError(null);
    onChange('', '');
  };

  return (
    <div className="pt-2 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#0F2942]">
            Optional: Pin Problem Location on Google Maps
          </p>
          <p className="mt-0.5 text-xs text-[#4B5563]">
            At the site? Pin your live GPS position, search any Uttarakhand village/landmark, or tap/drag on the map.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePinCurrentLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D7A6F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0A635A] disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{locating ? 'Locating...' : 'Pin My Current Location'}</span>
          </button>

          {pinPosition && (
            <button
              type="button"
              onClick={handleClearPin}
              className="inline-flex items-center gap-1 rounded-lg border border-[#E2E6EC] bg-white px-2.5 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#F7F6F2]"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear Pin</span>
            </button>
          )}
        </div>
      </div>

      {apiKey ? (
        <APIProvider
          apiKey={apiKey}
          libraries={['marker', 'places']}
          language="en"
          region="IN"
        >
          <div className="space-y-3">
            <GoogleMapsPlaceSearch
              suggestedCenter={suggestedCenter}
              onPlaceCoordinates={(nextLat, nextLng) => applyCoordinates(nextLat, nextLng, true)}
            />
            <InteractivePinMapCanvas
              pinPosition={pinPosition}
              suggestedCenter={suggestedCenter}
              focusNonce={focusNonce}
              onMapClick={(nextLat, nextLng) => applyCoordinates(nextLat, nextLng)}
              onMarkerDragEnd={(nextLat, nextLng) => applyCoordinates(nextLat, nextLng)}
            />
          </div>
        </APIProvider>
      ) : (
        <div className="flex h-52 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F7F6F2] px-6 text-center">
          <MapPin className="w-6 h-6 text-[#0F2942] mb-2" aria-hidden="true" />
          <p className="text-sm font-semibold text-[#0F2942]">Google Maps view requires an active Maps API key</p>
          <p className="mt-1 max-w-md text-xs text-[#4B5563]">
            You can still use <strong>Pin My Current Location</strong> above to attach your live GPS pin, or continue
            without pinning a map spot.
          </p>
        </div>
      )}

      {(localError || error) && (
        <p role="alert" className="text-xs text-red-700">
          {localError || error}
        </p>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-3 py-2.5 text-xs text-[#374151]">
        <Shield className="w-3.5 h-3.5 text-[#0D7A6F] shrink-0 mt-0.5" aria-hidden="true" />
        {pinPosition ? (
          <span>
            <strong className="text-[#0F2942]">Pinned site spot:</strong>{' '}
            <span className="font-mono text-[#0F2942]">
              {pinPosition.lat.toFixed(5)}, {pinPosition.lng.toFixed(5)}
            </span>{' '}
            · Shared only with moderators for verification, never shown publicly. Drag the pin or tap the map to adjust.
          </span>
        ) : (
          <span>
            Optional: Search any Uttarakhand place, tap the map, or use <strong>Pin My Current Location</strong> when you
            are at the site. Exact pinned coordinates are visible only to moderators.
          </span>
        )}
      </div>
    </div>
  );
}
