// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MapPage from "./pages/MapPage";
import ResultsPage from "./pages/ResultsPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NearestPointPage from "./pages/NearestPointPage";
import CompareDistrictsPage from "./pages/CompareDistrictsPage";

const ProtectedRoute = ({ element }: { element: JSX.Element }) => {
  const isAuthenticated = !!localStorage.getItem("token");
  return isAuthenticated ? element : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedRoute element={<MapPage />} />} />
        <Route path="/resultados" element={<ProtectedRoute element={<ResultsPage />} />} />
        <Route path="/punto-mas-cercano" element={<NearestPointPage />} />
        <Route path="/comparar-distritos" element={<CompareDistrictsPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
