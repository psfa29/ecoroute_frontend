// src/pages/NearestPointPage.tsx
import { useEffect, useRef, useState } from "react";
import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import Papa from "papaparse";
import type { ParseResult } from "papaparse";
import { useNavigate } from "react-router-dom";
import "./MapPage.css";
import logo from "../assets/logo.png";
import Sidebar from "../components/Sidebar";

type Stop = {
  id: string;
  lat: number;
  lng: number;
  address?: string;
  distrito?: string;
};

type RawRow = {
  direccion: string;
  latitud: string;
  longitud: string;
  distrito: string;
};

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const LIMA_CENTER = { lat: -12.0464, lng: -77.0428 };

// Haversine en km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function NearestPointPage() {
  const nav = useNavigate();
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
    libraries: [], // igual que MapPage para evitar el error del loader
  });

  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<google.maps.LatLngLiteral | null>(null);
  const [nearestStop, setNearestStop] = useState<{ stop: Stop; distanceKm: number } | null>(null);

  // ================
  // CARGAR TODOS LOS CONTENEDORES (toda Lima)
  // ================
  useEffect(() => {
    Papa.parse<RawRow>("/tachos_lima_callao_con_direcciones.csv", {
      header: true,
      download: true,
      complete: (res: ParseResult<RawRow>) => {
        const rows = res.data.filter((r) => r.latitud && r.longitud);

        const parsed: Stop[] = rows.map((r, i) => ({
          id: `C-${i}`,
          lat: parseFloat(r.latitud),
          lng: parseFloat(r.longitud),
          address: r.direccion,
          distrito: r.distrito,
        }));

        setAllStops(parsed);
      },
    });
  }, []);

  const onLoad = (map: google.maps.Map) => {
    mapRef.current = map;
  };

  // ================
  // CLICK EN EL MAPA
  // ================
  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    const latLng = e.latLng;
    if (!latLng) return;

    const clicked = { lat: latLng.lat(), lng: latLng.lng() };
    setSelectedPoint(clicked);

    if (!allStops.length) return;

    // Buscar contenedor más cercano en TODO allStops
    let minDist = Number.POSITIVE_INFINITY;
    let best: Stop | null = null;

    for (const s of allStops) {
      const d = haversineKm(clicked.lat, clicked.lng, s.lat, s.lng);
      if (d < minDist) {
        minDist = d;
        best = s;
      }
    }

    if (best) {
      setNearestStop({ stop: best, distanceKm: minDist });

      // Opcional: centrar un poco si quieres
      if (mapRef.current) {
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(clicked);
        bounds.extend({ lat: best.lat, lng: best.lng });
        mapRef.current.fitBounds(bounds);
      }
    } else {
      setNearestStop(null);
    }
  };

  // Path de la línea entre punto seleccionado y contenedor más cercano
  const connectionPath: google.maps.LatLngLiteral[] =
    selectedPoint && nearestStop
      ? [
          selectedPoint,
          { lat: nearestStop.stop.lat, lng: nearestStop.stop.lng },
        ]
      : [];

  return (
    <div className="shell">
      <Sidebar />

      {/* MAIN */}
      <main className="main">
        <h1 className="title">Buscar contenedor más cercano</h1>
        <p style={{ marginBottom: 12, color: "#4b5563", fontSize: 14 }}>
          Haz clic en cualquier punto del mapa para encontrar el contenedor más cercano en toda Lima y Callao.
        </p>

        <div className="card" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, minHeight: 400 }}>
          {/* MAPA */}
          <div className="map-area">
            {isLoaded && (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={LIMA_CENTER}
                zoom={12}
                onLoad={onLoad}
                onClick={handleMapClick}
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                }}
              >
                {/* Punto seleccionado por el usuario */}
                {selectedPoint && (
                  <Marker
                    position={selectedPoint}
                    icon={{
                      url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                      scaledSize: new google.maps.Size(32, 32),
                    }}
                  />
                )}

                {/* Contenedor más cercano */}
                {nearestStop && (
                  <Marker
                    position={{ lat: nearestStop.stop.lat, lng: nearestStop.stop.lng }}
                    icon={{
                      url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
                      scaledSize: new google.maps.Size(32, 32),
                    }}
                  />
                )}

                {/* Línea entre ambos puntos */}
                {connectionPath.length === 2 && (
                  <Polyline
                    path={connectionPath}
                    options={{
                      strokeColor: "#0ea5e9",
                      strokeWeight: 4,
                    }}
                  />
                )}
              </GoogleMap>
            )}
          </div>

          {/* PANEL DE INFO */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: 16,
                minHeight: 120,
              }}
            >
              <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600 }}>
                Información del punto seleccionado
              </h3>

              {!selectedPoint && (
                <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                  Aún no has seleccionado ningún punto. Haz clic en el mapa para empezar.
                </p>
              )}

              {selectedPoint && !nearestStop && (
                <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                  Buscando contenedor más cercano...
                </p>
              )}

              {selectedPoint && nearestStop && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>Distrito:</span>{" "}
                    {nearestStop.stop.distrito || "–"}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600 }}>Dirección del contenedor:</span>{" "}
                    {nearestStop.stop.address || nearestStop.stop.id}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600 }}>Distancia aproximada:</span>{" "}
                    {nearestStop.distanceKm.toFixed(3)} km
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                background: "#eff6ff",
                borderRadius: 10,
                border: "1px solid #bfdbfe",
                padding: 12,
                fontSize: 13,
                color: "#1d4ed8",
              }}
            >
              <strong>Tip:</strong> Puedes hacer clic varias veces en diferentes puntos para comparar
              qué tan lejos están de los contenedores más cercanos.
            </div>
          </div>
        </div>

        <div className="footer-actions">
          <button className="primary-btn" onClick={() => nav("/")}>
            ← Volver al mapa principal
          </button>
        </div>
      </main>
    </div>
  );
}
