import { useMemo, useState } from 'react';
import { Button } from './Button';
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';

type Coordinates = {
  lat: number;
  lng: number;
};

interface LocationPickerMapProps {
  onCancel: () => void;
  onConfirm: (coords: Coordinates) => void;
  initialCenter?: Coordinates;
}

function ClickSelector({
  onPick,
  pickedPosition
}: {
  onPick: (coords: Coordinates) => void;
  pickedPosition: Coordinates | null;
}) {
  useMapEvents({
    click: (event: LeafletMouseEvent) => {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });

  if (!pickedPosition) {
    return null;
  }

  return (
    <CircleMarker
      center={[pickedPosition.lat, pickedPosition.lng]}
      radius={9}
      pathOptions={{ color: '#ff5a5f', fillColor: '#ff5a5f', fillOpacity: 0.85 }}
    />
  );
}

export function LocationPickerMap({ onCancel, onConfirm, initialCenter }: LocationPickerMapProps) {
  const fallbackCenter = useMemo<Coordinates>(() => ({ lat: -6.7924, lng: 39.2083 }), []);
  const mapCenter = initialCenter || fallbackCenter;
  const [pickedPosition, setPickedPosition] = useState<Coordinates | null>(initialCenter || null);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '900px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h3 className="text-h3" style={{ marginBottom: '4px' }}>Pick Your Location on Map</h3>
            <p className="text-sm text-muted">Tap anywhere on the map, then confirm.</p>
          </div>
          {pickedPosition && (
            <span className="text-sm text-muted">
              {pickedPosition.lat.toFixed(5)}, {pickedPosition.lng.toFixed(5)}
            </span>
          )}
        </div>

        <div style={{ height: '500px' }}>
          <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={14} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickSelector onPick={setPickedPosition} pickedPosition={pickedPosition} />
          </MapContainer>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={!pickedPosition} onClick={() => pickedPosition && onConfirm(pickedPosition)}>
            Use This Location
          </Button>
        </div>
      </div>
    </div>
  );
}
