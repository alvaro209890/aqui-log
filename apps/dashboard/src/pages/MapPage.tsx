import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, type DeliveryRecord } from '../api';
import { LiveMap } from '../LiveMap';

export function MapPage({ token }: { token: string }) {
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);

  useEffect(() => {
    api
      .deliveries(token)
      .then((items) => setDeliveries(items.slice(0, 50)))
      .catch((err: Error) => toast.error(err.message));
  }, [token]);

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>TEMPO REAL</p>
          <h1>Mapa ao vivo</h1>
          <span>Entregas com coordenadas no mapa operacional.</span>
        </div>
      </section>
      <section className="panel map-page-panel">
        <div className="map-canvas tall">
          <LiveMap deliveries={deliveries} token={token} />
        </div>
      </section>
    </div>
  );
}
