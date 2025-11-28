import { useLocation, useNavigate } from "react-router-dom";
import {
  GoogleMap,
  Polyline,
  OverlayView,
  useJsApiLoader,
} from "@react-google-maps/api";
import "./MapPage.css";
import logo from "../assets/logo.png";
import Sidebar from "../components/Sidebar";

type Leg = {
  from_index: number;
  to_index: number;
  distance_km: number;
  duration_min: number;
};

type GJ = { features: any[] };

type Stop = {
  id: string;
  lat: number;
  lng: number;
  address?: string;
};

type ResultsState = {
  distrito: string;
  pointsCount: number;
  total_distance_km: number;
  total_duration_min: number;
  co2_kg: number;
  legs: Leg[];
  routePath: GJ;
  mst: GJ;
  stops: Stop[];
  startPoint: string;
};

const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

export default function ResultsPage() {
  const nav = useNavigate();
  const { state } = useLocation() as { state?: ResultsState };

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: [],
  });

  if (!state) {
    return (
      <div className="shell">
        <Sidebar />
        <main className="main">
          <h1 className="title">No hay resultados</h1>
        </main>
      </div>
    );
  }

  // =============================
  // STATE VALUES
  // =============================
  const {
    distrito,
    pointsCount,
    total_distance_km,
    total_duration_min,
    co2_kg,
    legs,
    routePath,
    mst,
    stops,
    startPoint,
  } = state;

  // =============================
  // PARSE ROUTE + MST
  // =============================
  const routeCoords =
    routePath?.features?.[0]?.geometry?.coordinates?.map(
      ([lng, lat]: any) => ({ lat, lng })
    ) || [];

  const mstLines =
    mst?.features?.map((f: any) =>
      f.geometry.coordinates.map(([lng, lat]: any) => ({ lat, lng }))
    ) || [];

  // =============================
  // BUILD ORDER INDEX NUMBERS
  // =============================
  const visitOrder = routeCoords.map((p: google.maps.LatLngLiteral) =>
     `${p.lat},${p.lng}`
  );

  const numberedStops = stops.map((s) => {
    const idx = visitOrder.indexOf(`${s.lat},${s.lng}`);
    return { ...s, order: idx };
  });

  return (
    <div className="shell">
      <Sidebar />

      <main className="main">
        <h1 className="title">Resumen de Ruta Óptima</h1>

        {/* =============================
            MAPA
        ============================= */}
        <div
          className="card"
          style={{ height: "420px", padding: 0, marginBottom: 20 }}
        >
          {isLoaded && (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              zoom={13}
              center={{
                lat: stops[0].lat,
                lng: stops[0].lng,
              }}
              options={{
                gestureHandling: "none",
                zoomControl: false,
                streetViewControl: false,
                mapTypeControl: false,
              }}
            >
              {/* 🔵 PUNTOS NUMERADOS */}
              {numberedStops.map((s) => (
                <OverlayView
                  key={s.id}
                  position={{ lat: s.lat, lng: s.lng }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div
                    style={{
                      background:
                        s.id === startPoint ? "#2962ff" : "#2ecc71",
                      color: "white",
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      fontSize: 14,
                      fontWeight: "bold",
                      border: "2px solid white",
                    }}
                  >
                    {s.order >= 0 ? s.order : "?"}
                  </div>
                </OverlayView>
              ))}

              {/* 🔷 MST LINES */}
              {mstLines.map((path, i) => (
                <Polyline
                  key={i}
                  path={path}
                  options={{
                    strokeColor: "#666",
                    strokeWeight: 2,
                    strokeOpacity: 0.4,
                  }}
                />
              ))}

              {/* 🔶 ROUTE */}
              {routeCoords.length > 1 && (
                <Polyline
                  path={routeCoords}
                  options={{
                    strokeColor: "#1976d2",
                    strokeWeight: 4,
                  }}
                />
              )}
            </GoogleMap>
          )}
        </div>

        {/* =============================
            KPIS
        ============================= */}
        <div className="card" style={{ gridTemplateColumns: "1fr" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            <Kpi label="Distrito" value={distrito} />
            <Kpi label="Puntos" value={String(pointsCount)} />
            <Kpi label="Distancia" value={`${total_distance_km.toFixed(2)} km`} />
            <Kpi label="Duración" value={`${Math.round(total_duration_min)} min`} />
          </div>
          <div style={{ marginTop: 16 }}>
            <Kpi label="CO₂ emitido" value={`${co2_kg.toFixed(2)} kg`} large />
          </div>
        </div>

        {/* =============================
            TABLA DE TRAMOS (CON CALLE)
        ============================= */}
        <div className="card" style={{ gridTemplateColumns: "1fr" }}>
          <h3 style={{ marginBottom: 16 }}>Detalle de Tramos</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <Th>#</Th>
                  <Th>Desde</Th>
                  <Th>Hacia</Th>
                  <Th>Calle</Th>
                  <Th>Distancia</Th>
                  <Th>Tiempo</Th>
                </tr>
              </thead>
              <tbody>
                {legs.map((l, i) => {
                  const from = numberedStops[l.from_index];
                  const to = numberedStops[l.to_index];

                  return (
                    <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <Td>{i + 1}</Td>
                      <Td>{`Punto ${l.from_index}`}</Td>
                      <Td>{`Punto ${l.to_index}`}</Td>
                      <Td>{to?.address || "Sin dirección"}</Td>
                      <Td>{l.distance_km.toFixed(2)} km</Td>
                      <Td>{`${Math.round(l.duration_min)} min`}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="footer-actions">
          <button className="primary-btn" onClick={() => nav("/")}>
            ← Volver al mapa
          </button>
        </div>
      </main>
    </div>
  );
}

/* ===========================================================
   COMPONENTES
=========================================================== */

function Kpi({
  label,
  value,
  large = false,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: large ? "20px 24px" : "16px 20px",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 13 }}>{label}</div>
      <div
        style={{
          fontSize: large ? 28 : 20,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "12px 16px",
        textAlign: "left",
        fontWeight: 600,
        fontSize: 13,
        color: "#6b7280",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "12px 16px", color: "#0f172a" }}>{children}</td>
  );
}
