import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Sidebar() {
  const nav = useNavigate();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path ? "active" : "";

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    nav("/login");
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          <img src={logo} alt="EcoRoute" />
        </div>
        <div className="brand-title">EcoRoute</div>
      </div>

      <nav className="nav">

        {/* Página principal */}
        <a
          className={`nav-item ${isActive("/")}`}
          onClick={() => nav("/")}
        >
           Planificador 
        </a>

        {/* Punto más cercano */}
        <a
          className={`nav-item ${isActive("/punto-mas-cercano")}`}
          onClick={() => nav("/punto-mas-cercano")}
        >
           Punto más cercano
        </a>

        {/* Comparar Distritos */}
        <a
          className={`nav-item ${isActive("/comparar-distritos")}`}
          onClick={() => nav("/comparar-distritos")}
        >
           Comparar Distritos
        </a>
      </nav>

      <div className="spacer" />

      <nav className="nav">
        <a className="nav-item" onClick={logout}>
           Cerrar Sesión
        </a>
      </nav>
    </aside>
  );
}
