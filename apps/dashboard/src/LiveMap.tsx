import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { io, type Socket } from 'socket.io-client';
import type { DeliveryRecord } from './api';

interface CourierPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  deliveryId?: string;
}

interface LiveMapProps {
  deliveries: DeliveryRecord[];
  token: string;
}

function createDivIcon(svg: string, color: string) {
  return L.divIcon({
    html: `<div style="background:${color};width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;box-shadow:0 2px 8px rgba(0,0,0,.3)">${svg}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

const pickupIcon = createDivIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 2-6-2-6"/><path d="M22 10H14"/><path d="M8 21V13"/><path d="M3 21h18"/></svg>',
  '#f97316',
);
const deliveryIcon = createDivIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="10" x2="14" y1="6" y2="6"/></svg>',
  '#6366f1',
);
const courierIcon = createDivIcon(
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="1"/><path d="M5 14h.01"/><path d="M18 14h.01"/><circle cx="10" cy="17" r="4"/><path d="M14 21v-4"/></svg>',
  '#22c55e',
);

export function LiveMap({ deliveries, token }: LiveMapProps) {
  const [couriers, setCouriers] = useState<CourierPin[]>([]);

  const routeLines = useMemo(() =>
    deliveries
      .filter((d) => d.pickupLatitude && d.deliveryLatitude)
      .map((d) => ({
        id: d.id,
        positions: [
          [d.pickupLatitude, d.pickupLongitude] as [number, number],
          [d.deliveryLatitude, d.deliveryLongitude] as [number, number],
        ],
        status: d.status,
      })),
    [deliveries],
  );

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';
    const socket: Socket = io(`${wsUrl}/tracking`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('delivery:watch', { deliveryId: 'broadcast' });
    });

    socket.on('delivery:location', (data: { deliveryId: string; latitude: number; longitude: number }) => {
      setCouriers((prev) => {
        const idx = prev.findIndex((c) => c.deliveryId === data.deliveryId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], latitude: data.latitude, longitude: data.longitude };
          return updated;
        }
        return [...prev, {
          id: data.deliveryId,
          name: `Entregador #${data.deliveryId.slice(0, 8)}`,
          latitude: data.latitude,
          longitude: data.longitude,
          deliveryId: data.deliveryId,
        }];
      });
    });

    return () => { socket.disconnect(); };
  }, [token]);

  const center: [number, number] = [-15.6014, -56.0979]; // Cuiabá

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%', borderRadius: 12 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {deliveries.filter((d) => d.pickupLatitude).map((d) => (
        <Marker key={`pickup-${d.id}`} position={[d.pickupLatitude, d.pickupLongitude]} icon={pickupIcon}>
          <Popup>
            📍 <strong>Coleta</strong><br />
            {d.pickupAddress}<br />
            <small>#{d.code}</small>
          </Popup>
        </Marker>
      ))}
      {deliveries.filter((d) => d.deliveryLatitude).map((d) => (
        <Marker key={`delivery-${d.id}`} position={[d.deliveryLatitude, d.deliveryLongitude]} icon={deliveryIcon}>
          <Popup>
            📦 <strong>Entrega</strong><br />
            {d.deliveryAddress}<br />
            <small>#{d.code}</small>
          </Popup>
        </Marker>
      ))}
      {couriers.map((c) => (
        <Marker key={c.id} position={[c.latitude, c.longitude]} icon={courierIcon}>
          <Popup>🛵 {c.name}</Popup>
        </Marker>
      ))}
      {routeLines.map((r) => (
        <Polyline
          key={r.id}
          positions={r.positions}
          color={r.status === 'DELIVERED' ? '#9ca3af' : '#f97316'}
          weight={2}
          dashArray={r.status === 'DELIVERED' ? '8 4' : undefined}
        />
      ))}
    </MapContainer>
  );
}
