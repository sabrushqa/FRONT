import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvent } from 'react-leaflet';
import { resolveCityCoordinate } from '../moroccoGeoData';
import './PdvLocationPicker.scss';

const MOROCCO_CENTER: [number, number] = [31.6, -7.2];
const MOROCCO_DEFAULT_ZOOM = 6;
const CITY_ZOOM = 13;

function RecenterOnVille({ ville }: { ville: string }) {
  const map = useMap();
  useEffect(() => {
    const coordinate = resolveCityCoordinate(ville);
    if (coordinate) {
      map.flyTo([coordinate.lat, coordinate.lon], CITY_ZOOM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ville]);
  return null;
}

function ClickToPlace({ disabled, onPick }: { disabled: boolean; onPick: (lat: number, lon: number) => void }) {
  useMapEvent('click', (event) => {
    if (disabled) return;
    onPick(event.latlng.lat, event.latlng.lng);
  });
  return null;
}

export default function PdvLocationPicker({
  ville,
  latitude,
  longitude,
  disabled = false,
  onChange
}: {
  ville: string;
  latitude: number | null;
  longitude: number | null;
  disabled?: boolean;
  onChange: (lat: number, lon: number) => void;
}) {
  const cityCoordinate = resolveCityCoordinate(ville);
  const initialCenter: [number, number] = cityCoordinate ? [cityCoordinate.lat, cityCoordinate.lon] : MOROCCO_CENTER;
  const initialZoom = cityCoordinate ? CITY_ZOOM : MOROCCO_DEFAULT_ZOOM;
  const hasPin = latitude !== null && longitude !== null;

  return (
    <div className={`pdv-location-picker${disabled ? ' is-disabled' : ''}`}>
      <MapContainer className="pdv-location-picker-map" center={initialCenter} zoom={initialZoom} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterOnVille ville={ville} />
        <ClickToPlace disabled={disabled} onPick={onChange} />
        {hasPin && (
          <CircleMarker
            center={[latitude as number, longitude as number]}
            radius={9}
            pathOptions={{ fillColor: '#D4537E', fillOpacity: 0.9, color: '#ffffff', weight: 2 }}
          />
        )}
      </MapContainer>
      <div className="pdv-location-picker-footer">
        {hasPin ? (
          <span className="pdv-location-picker-coords">
            {(latitude as number).toFixed(5)}, {(longitude as number).toFixed(5)}
          </span>
        ) : (
          <span className="pdv-location-picker-hint">Cliquez sur la carte pour pointer l'emplacement exact du PDV.</span>
        )}
      </div>
    </div>
  );
}
