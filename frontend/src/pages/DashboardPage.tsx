import type { DashboardData, Episode } from "../types/clinical";

type DashboardPageProps = {
  dashboard: DashboardData;
  onRefresh: () => Promise<void>;
  onOpenEpisode: (id: number) => Promise<void>;
};

export default function DashboardPage({
  dashboard,
  onRefresh,
  onOpenEpisode,
}: DashboardPageProps) {
  return (
    <main className="container">
      <div className="page-title">
        <div>
          <span>OPERACIÓN EN TIEMPO REAL</span>
          <h1>Centro de control</h1>
        </div>

        <button onClick={onRefresh}>Actualizar</button>
      </div>

      <section className="stats">
        <article>
          <strong>{dashboard.active}</strong>
          <span>Pacientes activos</span>
        </article>

        <article className="danger">
          <strong>{dashboard.open_alerts}</strong>
          <span>Alertas abiertas</span>
        </article>

        <article>
          <strong>
            {
              dashboard.patients.filter(
                (patient: Episode) => patient.priority <= 2,
              ).length
            }
          </strong>
          <span>Alta prioridad</span>
        </article>

        <article>
          <strong>
            {dashboard.patients.reduce(
              (total: number, patient: Episode) =>
                total +
                patient.tasks.filter(
                  (task) => task.status === "PENDING",
                ).length,
              0,
            )}
          </strong>
          <span>Tareas pendientes</span>
        </article>
      </section>

      <section className="panel">
        <h2>Pacientes activos</h2>

        {dashboard.patients.length === 0 ? (
          <p>No hay pacientes activos.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Prioridad</th>
                <th>Ubicación</th>
                <th>Alertas</th>
                <th>Acción</th>
              </tr>
            </thead>

            <tbody>
              {dashboard.patients.map((patient: Episode) => (
                <tr key={patient.id}>
                  <td>
                    <strong>{patient.name}</strong>
                    <small>EP-{patient.id}</small>
                  </td>
                  <td>
                    <span className={`priority p${patient.priority}`}>
                      P{patient.priority}
                    </span>
                  </td>
                  <td>{patient.location}</td>
                  <td>
                    {
                      patient.alerts.filter(
                        (alert) => alert.status !== "RESOLVED",
                      ).length
                    }
                  </td>
                  <td>
                    <button onClick={() => onOpenEpisode(patient.id)}>
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
