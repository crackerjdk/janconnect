import React, { useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  Map as GoogleMapView,
  Pin,
  useApiLoadingStatus,
  useMap,
  type MapMouseEvent,
} from '@vis.gl/react-google-maps';
import { Crosshair, Loader2, MapPin, RotateCcw, Shield } from 'lucide-react';
import { normalizePinnedCoordinates } from '../../utils/civicRules';

const DEFAULT_UTTARAKHAND_CENTER = { lat: 30.3165, lng: 78.0322 };

interface GoogleMapPinPickerProps {
  lat: string;
  lng: string;
  suggestedCenter: { lat: number; lng: number } | null;
  onChange: (lat: string, lng: string) => void;
  error?: string;
}

interface ViewportSyncProps {
  pinPosition: { lat: number; lng: number } | null;
  suggestedCenter: { lat: number; lng: number } | null;
  gpsFocusNonce: number;
}

function MapViewportSync({ pinPosition, suggestedCenter, gpsFocusNonce }: ViewportSyncProps) {
  const map = useMap();

  useEffect(() => {
    if (!map || gpsFocusNonce === 0 || !pinPosition) return;
    map.panTo(pinPosition);
    const currentZoom = map.getZoom();
    if (typeof currentZoom !== 'number' || currentZoom < 16) {
      map.setZoom(16);
    }
  }, [map, gpsFocusNonce, pinPosition]);

  useEffect(() => {
    if (!map || pinPosition || !suggestedCenter) return;
    map.panTo(suggestedCenter);
    map.setZoom(12);
  }, [map, pinPosition, suggestedCenter]);

  return null;
}

interface MapCanvasProps {
  pinPosition: { lat: number; lng: number } | null;
  suggestedCenter: { lat: number; lng: number } | null;
  gpsFocusNonce: number;
  onMapClick: (lat: number, lng: number) => void;
  onMarkerDragEnd: (lat: number, lng: number) => void;
}

function InteractivePinMapCanvas({
  pinPosition,
  suggestedCenter,
  gpsFocusNonce,
  onMapClick,
  onMarkerDragEnd,
}: MapCanvasProps) {
  const status = useApiLoadingStatus();
  const initialCenter = useMemo(
    () => pinPosition || suggestedCenter || DEFAULT_UTTARAKHAND_CENTER,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const initialZoom = pinPosition ? 16 : suggestedCenter ? 12 : 9;

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
          gpsFocusNonce={gpsFocusNonce}
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
  const [gpsFocusNonce, setGpsFocusNonce] = useState(0);

  const pinPosition = useMemo(() => {
    if (!lat || !lng) return null;
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
    return { lat: parsedLat, lng: parsedLng };
  }, [lat, lng]);

  const applyCoordinates = (rawLat: number, rawLng: number, fromGps = false) => {
    const normalized = normalizePinnedCoordinates(rawLat, rawLng);
    if (!normalized.valid) {
      setLocalError(normalized.error || 'Pinned location must fall within India.');
      return;
    }
    setLocalError(null);
    onChange(normalized.lat, normalized.lng);
    if (fromGps) {
      setGpsFocusNonce((n) => n + 1);
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
            At the site? Pin your live GPS position or tap/drag on the map to mark the exact spot. You can also skip this step.
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
          libraries={['marker']}
          language="en"
          region="IN"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          <InteractivePinMapCanvas
            pinPosition={pinPosition}
            suggestedCenter={suggestedCenter}
            gpsFocusNonce={gpsFocusNonce}
            onMapClick={(nextLat, nextLng) => applyCoordinates(nextLat, nextLng)}
            onMarkerDragEnd={(nextLat, nextLng) => applyCoordinates(nextLat, nextLng)}
          />
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
            Optional: Tap anywhere on the map or use <strong>Pin My Current Location</strong> when you are at the site.
            Exact pinned coordinates are visible only to moderators.
          </span>
        )}
      </div>
    </div>
  );
}
