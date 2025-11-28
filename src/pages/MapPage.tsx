import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import Papa from "papaparse";
import type { ParseResult } from "papaparse";
import axios from "axios";
import "./MapPage.css";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

// Tipos
type Stop = {
  id?: string;
  lat: number;
  lng: number;
  address?: string;
  distrito?: string;
};

type Leg = {
  from_index: number;
  to_index: number;
  distance_km: number;
  duration_min: number;
};

type OptimizeMstRes = {
  order: number[];
  legs: Leg[];
  total_distance_km: number;
  total_duration_min: number;
  co2_kg: number;
  geojson: any;
  mst_geojson: any;
};

type RawRow = {
  direccion: string;
  latitud: string;
  longitud: string;
  distrito: string;
};

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };
const LIMA_CENTER = { lat: -12.0464, lng: -77.0428 };

export default function MapPage() {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: API_KEY, libraries: [] });
  const mapRef = useRef<google.maps.Map | null>(null);

  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [distritos, setDistritos] = useState<string[]>([]);
  const [distrito, setDistrito] = useState<string>("");
  const [filteredStops, setFilteredStops] = useState<Stop[]>([]);
  const [selectedStops, setSelectedStops] = useState<Set<string>>(new Set());
  const [startPoint, setStartPoint] = useState<string | null>(null);
  const [route, setRoute] = useState<OptimizeMstRes | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  const nav = useNavigate();

  // ===========================
  // CARGAR CSV — carga todos los contenedores de Lima y Callao
  // ===========================
  useEffect(() => {
    Papa.parse<RawRow>("/tachos_lima_callao_con_direcciones.csv", {
      header: true,
      download: true,
      complete: (res: ParseResult<RawRow>) => {
        const rows = res.data.filter((r) => r.latitud && r.longitud);

        const parsed = rows.map((r, i) => ({
          id: `C-${i}`,
          lat: parseFloat(r.latitud),
          lng: parseFloat(r.longitud),
          address: r.direccion,
          distrito: r.distrito,
        }));

        setAllStops(parsed);
        setSelectedStops(new Set(parsed.map((p) => p.id!)));

        const uniq = Array.from(new Set(parsed.map((s) => s.distrito))).sort();
        setDistritos(uniq);
        setDistrito("");
      },
    });
  }, []);

  // ===========================
  // FILTRAR POR DISTRITO — filtra marcadores y ajusta el mapa
  // ===========================
  useEffect(() => {
    setRoute(null);

    if (!distrito) {
      setFilteredStops([]);
      return;
    }

    const f = allStops.filter((s) => s.distrito === distrito);
    setFilteredStops(f);
    setMapKey((prev) => prev + 1);

    setTimeout(() => {
      if (mapRef.current && f.length) {
        const bounds = new google.maps.LatLngBounds();
        f.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
        mapRef.current.fitBounds(bounds);
      }
    }, 120);
  }, [distrito, allStops]);

  const onLoad = (map: google.maps.Map) => {
    mapRef.current = map;
  };

  // ===========================
  // ASIGNAR PUNTO INICIAL (clic derecho)
  // ===========================
  const setAsStartPoint = (id: string | undefined) => {
    if (!id) return;
    setStartPoint(id);
    setSelectedStops((prev) => new Set(prev).add(id)); // no se puede deseleccionar
  };

  // ===========================
  // TOGGLE SELECCIÓN (clic izquierdo)
  // ===========================
  const toggleStop = (id: string | undefined) => {
    if (!id) return;
    if (startPoint === id) return; // evitar deseleccionar punto inicial

    setSelectedStops((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  // ===========================
  // GENERAR RUTA — llamada al backend optimize_mst
  // ===========================
  const generateRoute = async () => {
    if (!startPoint) {
      alert("Debes elegir un punto inicial (clic derecho en un contenedor).");
      return;
    }

    const depotStop = filteredStops.find((s) => s.id === startPoint);

    if (!depotStop) {
      alert("Error: Punto inicial inválido.");
      return;
    }

    const finalStops = filteredStops.filter((s) => selectedStops.has(s.id!));

    if (!finalStops.length) {
      alert("Debes seleccionar al menos un contenedor.");
      return;
    }

    setLoading(true);
    setRoute(null);

    try {
      const payload = {
        depot: {
          id: depotStop.id,
          lat: depotStop.lat,
          lng: depotStop.lng,
          address: depotStop.address,
        },
        stops: finalStops.map((s) => ({
          lat: s.lat,
          lng: s.lng,
          id: s.id,
          address: s.address,
        })),
        return_to_depot: false,
        average_speed_kmh: 25.0,
        liters_per_km: 0.4,
      };

      const { data } = await axios.post<OptimizeMstRes>(`${API_BASE}/optimize_mst`, payload);

      nav("/resultados", {
        state: {
          distrito,
          pointsCount: finalStops.length,
          total_distance_km: data.total_distance_km,
          total_duration_min: data.total_duration_min,
          co2_kg: data.co2_kg,
          legs: data.legs,
          routePath: data.geojson,
          mst: data.mst_geojson,
          stops: [depotStop, ...finalStops],
          startPoint: depotStop.id,
        },
      });
    } catch (e) {
      console.error(e);
      alert("Error generando ruta");
    } finally {
      setLoading(false);
    }
  };

  // PARSE GEOJSON
  const routePath = useMemo(() => {
    if (!route?.geojson?.features?.length) return [];
    const line = route.geojson.features.find((f: any) => f.geometry?.type === "LineString");
    return line ? line.geometry.coordinates.map(([lng, lat]: any) => ({ lat, lng })) : [];
  }, [route]);

  const mstLines = useMemo(() => {
    if (!route?.mst_geojson?.features) return [];
    return route.mst_geojson.features
      .filter((f: any) => f.geometry?.type === "LineString")
      .map((f: any) => f.geometry.coordinates.map(([lng, lat]: any) => ({ lat, lng })));
  }, [route]);

  // CONTADORES
  const selectedCount = filteredStops.filter((s) => selectedStops.has(s.id!)).length;
  const deselectedCount = filteredStops.length - selectedCount;

  return (
    <div className="shell">
      <Sidebar />

      <main className="main">
        <h1 className="title">Visualización de Contenedores</h1>

        {/* ===============================
            SELECCIÓN DE DISTRITO
        =============================== */}
        <div className="toolbar">
          Distrito:
          <select className="select" value={distrito} onChange={(e) => setDistrito(e.target.value)}>
            {distritos.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* ===============================
            MAPA PRINCIPAL
        =============================== */}
        <div
          className="card"
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 16,
            minHeight: 400,
          }}
        >
          {/* MAPA */}
          <div className="map-area">
            {isLoaded && (
              <GoogleMap
                key={mapKey}
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={LIMA_CENTER}
                zoom={12}
                onLoad={onLoad}
                options={{
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                }}
              >
                {filteredStops.map((s) => {
                  const isSelected = selectedStops.has(s.id!);
                  const iconUrl =
                    startPoint === s.id
                      ? "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                      : isSelected
                      ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                      : "http://maps.google.com/mapfiles/ms/icons/red-dot.png";

                  return (
                    <Marker
                      key={s.id}
                      position={{ lat: s.lat, lng: s.lng }}
                      title={s.address || s.id}
                      onClick={() => toggleStop(s.id)}
                      onRightClick={() => setAsStartPoint(s.id)}
                      icon={{ url: iconUrl, scaledSize: new google.maps.Size(32, 32) }}
                    />
                  );
                })}

                {/* MST */}
                {mstLines.map((path: google.maps.LatLngLiteral[], i: number) => (
                  <Polyline key={i} path={path} options={{ strokeOpacity: 0.5, strokeWeight: 2 }} />
                ))}

                {/* RUTA */}
                {routePath.length > 1 && (
                  <Polyline path={routePath} options={{ strokeWeight: 5 }} />
                )}
              </GoogleMap>
            )}
          </div>

          {/* PANEL DE INSTRUCCIONES — MISMO ESTILO */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: 16,
              }}
            >
              <div style={{ fontSize: 14, color: "#374151", display: "flex", flexDirection: "column", gap: 6 }}>
                <span>• Selecciona un distrito para cargar los contenedores.</span>
                <span>• Haz <strong>clic izquierdo</strong> en un contenedor para seleccionarlo.</span>
                <span>• Haz <strong>clic derecho</strong> para definir el <strong>punto inicial</strong>.</span>
                <span>• El punto inicial no puede desmarcarse.</span>
                <span>• Cuando termines, presiona <strong>“Generar ruta óptima”</strong>.</span>
              </div>
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
              <strong>Tip:</strong> Cambia el punto inicial para comparar rutas más eficientes.
            </div>

            {/* LEYENDA */}
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: 16,
                marginTop: 4,
              }}
            >

              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
                <div><span className="dot dot-green" /> Contenedor seleccionado ({selectedCount})</div>
                <div><span className="dot dot-red" /> Contenedor deseleccionado ({deselectedCount})</div>
                <div><span className="dot dot-blue" /> Punto inicial ({startPoint ? 1 : 0})</div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTÓN */}
        <div className="footer-actions">
          <button onClick={generateRoute} disabled={loading} className="primary-btn">
            {loading ? "Calculando..." : "Generar ruta óptima"}
          </button>
        </div>
      </main>
    </div>
  );
}
