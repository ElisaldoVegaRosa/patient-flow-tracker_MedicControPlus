import { IdentityBadge } from "../components/PatientIdentity";
import type { HistoryData } from "../types/clinical";
import { clinicalLabel } from "../presentation/clinicalLabels";
import PatientSearch from "../components/PatientSearch";
import { usePatientSearch } from "../hooks/usePatientSearch";

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
  const search = usePatientSearch();
  const episodes = historyData.episodes.filter(episode => search.matches(episode.name, episode.id));
  return (
  <main className="container">
    <div className="page-title">
      <div>
        <span>CONSULTA HISTÓRICA</span>
        <h1>Episodios cerrados y anulados</h1>
        <p>
          Pacientes dados de alta e ingresos anulados, conservados para consulta.
        </p>
      </div>

      <button onClick={onRefresh}>
        Actualizar historial
      </button>
    </div>

    <section className="history-summary">
      <article>
        <strong>{historyData.total}</strong>
        <span>Episodios históricos</span>
      </article>
    </section>

    <section className="panel history-table">
      <PatientSearch query={search.query} onChange={search.setQuery} count={episodes.length} total={historyData.episodes.length} unit="episodios" />
      {historyData.episodes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✓</div>
          <h2>No existen episodios históricos</h2>
          <p>
            Los pacientes dados de alta aparecerán aquí.
          </p>
        </div>
      ) : episodes.length === 0 ? (
        <p>No hay coincidencias con la búsqueda.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Estado</th>
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
            {episodes.map((closedEpisode) => (
              <tr key={closedEpisode.id}>
                <td>
                  <strong>{closedEpisode.name}<IdentityBadge status={closedEpisode.identity_status} /></strong>
                  <small>EP-{closedEpisode.id}</small>
                </td>
                <td>{clinicalLabel("episodeStatus", closedEpisode.status)}</td>

                <td>{closedEpisode.document ?? "No registrado"}</td>

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
                    Ver línea de tiempo
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
