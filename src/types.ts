export type Stop = { id?: string; lat: number; lng: number; address?: string; distrito?: string };

export type Leg = { from_index: number; to_index: number; distance_km: number; duration_min: number };

export type OptimizeMstRes = {
  order: number[];
  legs: Leg[];
  total_distance_km: number;
  total_duration_min: number;
  co2_kg: number;
  geojson: any;      // FeatureCollection (LineString de la ruta)
  mst_geojson: any;  // FeatureCollection (LineString(s) del MST)
};
