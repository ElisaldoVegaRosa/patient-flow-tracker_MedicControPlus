import type { HistoryData } from "../types/clinical";

type EpisodeHistoryPageProps = {
  historyData: HistoryData;
  onRefresh: () => Promise<void>;
  onOpenEpisode: (id: number) => Promise<void>;
};

export default function EpisodeHistoryPage({
  historyData,
  onRefresh,
  onOpenEpisode,
}: EpisodeHistoryPageProps) {
  return (
  <main className="container">
    <div className="page-title">
      <div>
        <span>CONSULTA HISTÓRICA</span>
        <h1>Episodios cerrados</h1>
        <p>
          Pacientes dados de alta y episodios finalizados.
        </p>
      </div>

      <button onClick={onRefresh}>
        Actualizar historial
      </button>
    </div>

    <section className="history-summary">
      <article>
        <strong>{historyData.total}</strong>
        <span>Episodios cerrados</span>
      </article>
    </section>

    <section className="panel history-table">
      {historyData.episodes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✓</div>
          <h2>No existen episodios cerrados</h2>
          <p>
            Los pacientes dados de alta aparecerán aquí.
          </p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Documento</th>
              <th>Prioridad</th>
              <th>Ubicación final</th>
              <th>Responsable</th>
              <th>Fecha de cierre</th>
              <th>Actividad</th>
              <th>Acción</th>
            </tr>
          </thead>

          <tbody>
            {historyData.episodes.map((closedEpisode) => (
              <tr key={closedEpisode.id}>
                <td>
                  <strong>{closedEpisode.name}</strong>
                  <small>EP-{closedEpisode.id}</small>
                </td>

                <td>{closedEpisode.document}</td>

                <td>
                  <span
                    className={`priority p${closedEpisode.priority}`}
                  >
                    P{closedEpisode.priority}
                  </span>
                </td>

                <td>{closedEpisode.location}</td>

                <td>
                  {closedEpisode.assigned_to || "Sin asignar"}
                </td>

                <td>
                  {closedEpisode.closed_at
                    ? new Date(
                        closedEpisode.closed_at,
                      ).toLocaleString()
                    : "Sin fecha"}
                </td>

                <td>
                  <div className="history-counts">
                    <span>
                      {closedEpisode.event_count} eventos
                    </span>

                    <span>
                      {closedEpisode.alert_count} alertas
                    </span>

                    <span>
                      {closedEpisode.task_count} tareas
                    </span>
                  </div>
                </td>

                <td>
                  <button
                    onClick={() => onOpenEpisode(closedEpisode.id)}
                  >
                    Ver timeline
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
