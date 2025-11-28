import { useEffect, useState, useRef } from "react";
import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import Papa from "papaparse";
import type { ParseResult } from "papaparse";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import "./MapPage.css";

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

type Leg = {
  from_index: number;
  to_index: number;
  distance_km: number;
  duration_min: number;
};

type OptimizeResponse = {
  total_distance_km: number;
  total_duration_min: number;
  co2_kg: number;
  legs: Leg[];
  geojson: any;
  mst_geojson: any;
};

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
const MAP_STYLE = { width: "100%", height: "400px" };
const LIMA_CENTER = { lat: -12.0464, lng: -77.0428 };
const MAP_OPTIONS: google.maps.MapOptions = {
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
};

export default function CompareDistrictsPage() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
    libraries: [], 
  });

  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [distritos, setDistritos] = useState<string[]>([]);
  const [d1, setD1] = useState<string>("");
  const [d2, setD2] = useState<string>("");

  const [res1, setRes1] = useState<OptimizeResponse | null>(null);
  const [res2, setRes2] = useState<OptimizeResponse | null>(null);

  const map1Ref = useRef<google.maps.Map | null>(null);
  const map2Ref = useRef<google.maps.Map | null>(null);

  // Para mostrar la cantidad de contenedores
  const [count1, setCount1] = useState<number>(0);
  const [count2, setCount2] = useState<number>(0);

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

        const uniq = Array.from(new Set(parsed.map((s) => s.distrito))).sort();
        setDistritos(uniq);

        setD1(uniq[0] || "");
        setD2(uniq[1] || "");
      },
    });
  }, []);

  const onLoad1 = (map: google.maps.Map) => { map1Ref.current = map; };
  const onLoad2 = (map: google.maps.Map) => { map2Ref.current = map; };

  const optimize = async () => {
    setRes1(null);
    setRes2(null);

    const stops1 = allStops.filter((s) => s.distrito === d1);
    const stops2 = allStops.filter((s) => s.distrito === d2);

    setCount1(stops1.length);
    setCount2(stops2.length);

    if (!stops1.length || !stops2.length) {
      alert("Ambos distritos deben tener contenedores.");
      return;
    }

    const payload1 = {
      depot: stops1[0],
      stops: stops1,
      return_to_depot: false,
      average_speed_kmh: 25.0,
      liters_per_km: 0.4,
    };

    const payload2 = {
      depot: stops2[0],
      stops: stops2,
      return_to_depot: false,
      average_speed_kmh: 25.0,
      liters_per_km: 0.4,
    };

    const [r1, r2] = await Promise.all([
      axios.post(`${API_BASE}/optimize_mst`, payload1),
      axios.post(`${API_BASE}/optimize_mst`, payload2),
    ]);

    setRes1(r1.data);
    setRes2(r2.data);

    if (map1Ref.current) map1Ref.current.panTo(LIMA_CENTER);
    if (map2Ref.current) map2Ref.current.panTo(LIMA_CENTER);
  };

  const parsePath = (geo: any) => {
    if (!geo?.features) return [];
    const line = geo.features.find((f: any) => f.geometry?.type === "LineString");
    if (!line) return [];
    return line.geometry.coordinates.map(([lng, lat]: any) => ({ lat, lng }));
  };

  return (
    <div className="shell">
      <Sidebar />

      <main className="main">
        <h1 className="title">Comparar distritos</h1>

        <p style={{ marginBottom: 16, color: "#4b5563" }}>
          Selecciona 2 distritos de Lima/Callao y compara sus rutas óptimas.
        </p>

        <div className="toolbar" style={{ display: "flex", gap: 16 }}>
          <div>
            Distrito A:
            <select className="select" value={d1} onChange={(e) => setD1(e.target.value)}>
              {distritos.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div>
            Distrito B:
            <select className="select" value={d2} onChange={(e) => setD2(e.target.value)}>
              {distritos.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>

          <button className="primary-btn" onClick={optimize}>Comparar rutas</button>
        </div>

        <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {/* MAPA 1 */}
          <div>
            <h3 style={{ marginBottom: 8 }}>
              {d1} — <span style={{ color: "#1d4ed8" }}>{count1} contenedores</span>
            </h3>
            {isLoaded && (
              <GoogleMap
                mapContainerStyle={MAP_STYLE}
                center={LIMA_CENTER}
                zoom={12}
                onLoad={onLoad1}
                options={MAP_OPTIONS}
              >
                {res1 && (
                  <Polyline
                    path={parsePath(res1.geojson)}
                    options={{ strokeWeight: 4, strokeColor: "#1d4ed8" }}
                  />
                )}
              </GoogleMap>
            )}
          </div>

          {/* MAPA 2 */}
          <div>
            <h3 style={{ marginBottom: 8 }}>
              {d2} — <span style={{ color: "#059669" }}>{count2} contenedores</span>
            </h3>
            {isLoaded && (
              <GoogleMap
                mapContainerStyle={MAP_STYLE}
                center={LIMA_CENTER}
                zoom={12}
                onLoad={onLoad2}
                options={MAP_OPTIONS}
              >
                {res2 && (
                  <Polyline
                    path={parsePath(res2.geojson)}
                    options={{ strokeWeight: 4, strokeColor: "#059669" }}
                  />
                )}
              </GoogleMap>
            )}
          </div>
        </div>

        {/* TABLA DE COMPARACIÓN */}
        {(res1 && res2) && (
          <div className="card" style={{ marginTop: 20 }}>
            <h2>Comparación técnica</h2>
            <table style={{ width: "100%", marginTop: 10 }}>
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>{d1}</th>
                  <th>{d2}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Cantidad de contenedores</td>
                  <td>{count1}</td>
                  <td>{count2}</td>
                </tr>
                <tr>
                  <td>Distancia total (km)</td>
                  <td>{res1.total_distance_km.toFixed(3)}</td>
                  <td>{res2.total_distance_km.toFixed(3)}</td>
                </tr>
                <tr>
                  <td>Duración total (min)</td>
                  <td>{res1.total_duration_min.toFixed(2)}</td>
                  <td>{res2.total_duration_min.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>CO₂ estimado (kg)</td>
                  <td>{res1.co2_kg.toFixed(3)}</td>
                  <td>{res2.co2_kg.toFixed(3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      </main>
    </div>
  );
}
