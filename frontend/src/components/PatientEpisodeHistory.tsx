import { useEffect, useRef, useState } from "react";
import { api, isSessionInterruption } from "../api/client";
import type { Episode, PatientEpisodeHistoryData, SessionUser } from "../types/clinical";
import { clinicalLabel } from "../presentation/clinicalLabels";
import { staffingAuditDate } from "./staffingAuditDate";

const pageSize = 5;
type Props = {
  episode: Episode; user: SessionUser; onOpenEpisode?: (id: number) => void;
  openingBlocked?: boolean;
};

export default function PatientEpisodeHistory({ episode, user, onOpenEpisode, openingBlocked = false }: Props) {
  if (!["RECEPTION", "DOCTOR", "SUPERVISOR"].includes(user.role) ||
      typeof episode.patient_id !== "number" || episode.patient_id <= 0) return null;
  return <History key={`${user.username}:${user.role}:${episode.id}:${episode.patient_id}`}
    episodeId={episode.id} patientId={episode.patient_id} onOpenEpisode={onOpenEpisode} openingBlocked={openingBlocked} />;
}

function History({ episodeId, patientId, onOpenEpisode, openingBlocked }: {
  episodeId: number; patientId: number; onOpenEpisode?: (id: number) => void; openingBlocked: boolean;
}) {
  const [data, setData] = useState<PatientEpisodeHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lifecycle = useRef<{ mounted: boolean; ticket: number; controller: AbortController | null }>({ mounted: false, ticket: 0, controller: null });
  useEffect(() => {
    const state = lifecycle.current;
    state.mounted = true;
    return () => { state.mounted = false; state.ticket++; state.controller?.abort(); };
  }, []);

  async function load(offset = 0) {
    const state = lifecycle.current;
    const ticket = ++state.ticket;
    state.controller?.abort();
    const current = new AbortController();
    state.controller = current;
    setLoading(true); setError("");
    try {
      const result = await api<PatientEpisodeHistoryData>(`/episodes/${episodeId}/patient-history?limit=${pageSize}&offset=${offset}`, { signal: current.signal });
      if (!state.mounted || ticket !== state.ticket) return;
      if (result.source_episode_id !== episodeId || result.patient_id !== patientId ||
          result.offset !== offset || result.limit !== pageSize) throw new Error("Historial de otro contexto");
      setData(result);
    } catch (exception) {
      if (!state.mounted || ticket !== state.ticket || current.signal.aborted || isSessionInterruption(exception)) return;
      setData(null);
      setError("No se pudo consultar el historial del paciente. Reintenta la consulta.");
    } finally {
      if (state.mounted && ticket === state.ticket) setLoading(false);
    }
  }

  return <section className="panel patient-episode-history" aria-label="Historial del paciente" aria-busy={loading}>
    <h2>Historial del paciente</h2>
    <p>Otros episodios cerrados y anulados de esta misma ficha.</p>
    <button type="button" disabled={loading} onClick={() => void load()}>
      {loading ? "Consultando historial…" : error ? "Reintentar historial del paciente" : data ? "Actualizar historial del paciente" : "Consultar historial del paciente"}
    </button>
    {error && <p role="alert">{error}</p>}
    {openingBlocked && <p>Espera a que termine el guardado antes de abrir otro episodio.</p>}
    {data && <>
      {data.total === 0 ? <p>No hay otros episodios cerrados o anulados en esta ficha.</p> : data.episodes.length === 0 ?
        <p>Esta página ya no contiene episodios. Actualiza o vuelve a la página anterior.</p> :
        <p role="status">Mostrando {data.offset + 1}–{data.offset + data.episodes.length} de {data.total} episodios.</p>}
      <div className="patient-history-list">
        {data.episodes.map(item => <article className="patient-history-entry" key={item.id}>
          <h3>EP-{item.id} · {clinicalLabel("episodeStatus", item.status)}</h3>
          <p>Ingreso: {staffingAuditDate(item.started_at)}</p>
          <p>Cierre: {item.closed_at ? staffingAuditDate(item.closed_at) : "Sin fecha de cierre registrada"}</p>
          <p className="patient-history-reason"><strong>Motivo de consulta:</strong>{" "}{item.consultation_reason ?? "No registrado"}</p>
          <p>Prioridad: P{item.priority} · Ubicación final: {item.location}</p>
          <button type="button" disabled={loading || openingBlocked || !onOpenEpisode} onClick={() => onOpenEpisode?.(item.id)}>Abrir episodio EP-{item.id}</button>
        </article>)}
      </div>
      {(data.total > pageSize || data.offset > 0) && <div className="patient-history-pagination">
        <button type="button" disabled={loading || data.offset === 0} onClick={() => void load(Math.max(0, data.offset - pageSize))}>Página anterior del historial del paciente</button>
        <button type="button" disabled={loading || data.offset + data.limit >= data.total} onClick={() => void load(data.offset + pageSize)}>Página siguiente del historial del paciente</button>
      </div>}
    </>}
  </section>;
}
