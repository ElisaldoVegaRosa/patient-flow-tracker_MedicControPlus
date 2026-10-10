import type { User } from "../types/clinical";

type AppHeaderProps = {
  user: User;
  onDashboard: () => void;
  onSupervisor: () => Promise<void>;
  onScan: () => void;
  onHistory: () => Promise<void>;
  onLaboratory: () => Promise<void>;
  onNewEpisode: () => void;
  onLogout: () => Promise<void>;
};

export default function AppHeader({
  user, onDashboard, onSupervisor, onScan, onHistory,
  onLaboratory, onNewEpisode, onLogout,
}: AppHeaderProps) {
  return (
      <header className="header">
        <div className="logo">✚ MedicControl+</div>

        <nav>
          <button
            onClick={onDashboard}
          >
            Centro de control
          </button>

          {user.role === "SUPERVISOR" && (
        <button onClick={onSupervisor}>
          Panel de supervisor
        </button>
          )}

          <button onClick={onScan}>
            Escanear pulsera
          </button>

          {(
  user.role === "RECEPTION" ||
  user.role === "DOCTOR" ||
  user.role === "SUPERVISOR"
) && (
  <button onClick={onHistory}>
    Historial de episodios
  </button>
)}

          {(user.role === "LAB" || user.role === "SUPERVISOR") && (
          <button onClick={onLaboratory}>
          Bandeja de laboratorio
        </button>
          )}

          {user.role === "RECEPTION" && (
            <button onClick={onNewEpisode}>
              Nuevo ingreso
            </button>
          )}
        </nav>

        <div className="user">
          <strong>{user.username}</strong>
          <span>{user.role}</span>
          <button onClick={onLogout}>Salir</button>
        </div>
      </header>
  );
}
