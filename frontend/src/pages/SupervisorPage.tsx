import type { SupervisorData } from "../types/clinical";

type SupervisorPageProps = {
  supervisorData: SupervisorData;
  supervisorFilter: string;
  rulesMessage: string;
  evaluatingRules: boolean;
  onLoadDemo: () => Promise<void>;
  onEvaluateRules: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onFilterChange: (filter: string) => void;
  onOpenEpisode: (episodeId: number) => Promise<void>;
};

export default function SupervisorPage({
  supervisorData, supervisorFilter, rulesMessage, evaluatingRules,
  onLoadDemo, onEvaluateRules, onRefresh, onFilterChange, onOpenEpisode,
}: SupervisorPageProps) {
  return (
  <main className="container">
    <div className="page-title">
      <div>
        <span>SUPERVISIÓN OPERACIONAL</span>
        <h1>Centro de control del supervisor</h1>
        <p>
          Prioridades, riesgos, alertas y carga asistencial.
        </p>
      </div>

<div className="page-actions">
  <button
    className="secondary-button"
    onClick={onLoadDemo}
  >
    Cargar datos de demostración
  </button>

  <button
    className="secondary-button"
    disabled={evaluatingRules}
    onClick={onEvaluateRules}
  >
    {evaluatingRules
      ? "Evaluando reglas temporales"
      : "Evaluar reglas temporales"}
  </button>

  <button onClick={onRefresh}>
    Actualizar indicadores
  </button>
</div>
    </div>

      <section className="rules-status">
  <div>
    <span className="rules-icon">⚙</span>

    <div>
      <strong>Motor de reglas actualizado</strong>
      <p>
        Se evaluaron{" "}
        {supervisorData.rules.evaluated_episodes} episodios activos.
      </p>
    </div>
  </div>

  <div className="rules-result">
    <strong>{supervisorData.rules.generated_alerts}</strong>
    <span>Nuevas alertas generadas</span>
  </div>
</section>

{rulesMessage && (
  <div className="success-banner">
    {rulesMessage}
  </div>
)}

    <section className="supervisor-stats">
      <article>
        <strong>
          {supervisorData.metrics.active_patients}
        </strong>
        <span>Pacientes activos</span>
      </article>

      <article className="warning-stat">
        <strong>
          {supervisorData.metrics.high_priority_patients}
        </strong>
        <span>Prioridad P1–P2</span>
      </article>

      <article className="danger-stat">
        <strong>
          {supervisorData.metrics.patients_at_risk}
        </strong>
        <span>Pacientes en riesgo</span>
      </article>

      <article className="danger-stat">
        <strong>
          {supervisorData.metrics.open_alerts}
        </strong>
        <span>Alertas abiertas</span>
      </article>

      <article>
        <strong>
          {supervisorData.metrics.pending_tasks}
        </strong>
        <span>Tareas pendientes</span>
      </article>
    </section>

    <section className="panel supervisor-table">
      <div className="supervisor-toolbar">
        <div>
          <h2>Seguimiento de pacientes</h2>
          <p>
            Filtra la operación para localizar situaciones prioritarias.
          </p>
        </div>

        <div className="filter-buttons">
          <button
            className={
              supervisorFilter === "ALL" ? "active-filter" : ""
            }
            onClick={() => onFilterChange("ALL")}
          >
            Todos
          </button>

          <button
            className={
              supervisorFilter === "RISK" ? "active-filter" : ""
            }
            onClick={() => onFilterChange("RISK")}
          >
            En riesgo
          </button>

          <button
            className={
              supervisorFilter === "HIGH" ? "active-filter" : ""
            }
            onClick={() => onFilterChange("HIGH")}
          >
            P1–P2
          </button>

          <button
            className={
              supervisorFilter === "ALERTS" ? "active-filter" : ""
            }
            onClick={() => onFilterChange("ALERTS")}
          >
            Con alertas
          </button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Prioridad</th>
            <th>Ubicación</th>
            <th>Espera</th>
            <th>Alertas</th>
            <th>Tareas</th>
            <th>Riesgo</th>
            <th>Acción</th>
          </tr>
        </thead>

        <tbody>
          {supervisorData.patients
            .filter((patient) => {
              if (supervisorFilter === "RISK") {
                return patient.at_risk;
              }

              if (supervisorFilter === "HIGH") {
                return patient.priority <= 2;
              }

              if (supervisorFilter === "ALERTS") {
                return patient.open_alert_count > 0;
              }

              return true;
            })
            .map((patient) => (
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
                  {patient.waiting_minutes} min
                </td>

                <td>
                  <span
                    className={
                      patient.open_alert_count > 0
                        ? "count-badge danger-count"
                        : "count-badge"
                    }
                  >
                    {patient.open_alert_count}
                  </span>
                </td>

                <td>
                  <span className="count-badge">
                    {patient.pending_task_count}
                  </span>
                </td>

                <td>
                  {patient.at_risk ? (
                    <span className="risk-badge">REQUIERE ATENCIÓN</span>
                  ) : (
                    <span className="stable-badge">ESTABLE</span>
                  )}
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
    </section>
  </main>
  );
}
