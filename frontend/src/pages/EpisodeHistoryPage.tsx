import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, isSessionInterruption } from "../api/client";
import { IdentityBadge } from "../components/PatientIdentity";
import { staffingAuditDate } from "../components/staffingAuditDate";
import type { HistoryData } from "../types/clinical";
import { clinicalLabel } from "../presentation/clinicalLabels";

const pageSize = 20;
type Props = { onOpenEpisode: (id: number) => Promise<void>; openingBlocked?: boolean };

export default function EpisodeHistoryPage({ onOpenEpisode, openingBlocked = false }: Props) {
  const [request, setRequest] = useState({ filters: "", offset: 0, revision: 0 });
  const query = `${request.filters}${request.filters ? "&" : ""}limit=${pageSize}&offset=${request.offset}`;
  const context = `${query}:${request.revision}`;
  const [result, setResult] = useState<{ context: string; data: HistoryData } | null>(null);
  const [failure, setFailure] = useState<{ context: string; message: string } | null>(null);
  const data = result?.context === context ? result.data : null;
  const error = failure?.context === context ? failure.message : "";
  const loading = !data && !error;
  const episodes = data?.episodes ?? [];
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void api<HistoryData>(`/episodes/history?${query}`, { signal: controller.signal }).then(value => {
      if (!active) return;
      if (value.limit !== pageSize || value.offset !== request.offset) throw new Error("La página recibida no corresponde a la consulta.");
      setResult({ context, data: value });
    }).catch(exception => {
      if (active && !isSessionInterruption(exception)) setFailure({ context, message: (exception as Error).message });
    });
    return () => { active = false; controller.abort(); };
  }, [context, query, request.offset]);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const start = String(values.get("closed_from") ?? "");
    const end = String(values.get("closed_to") ?? "");
    const input = event.currentTarget.elements.namedItem("closed_to") as HTMLInputElement;
    input.setCustomValidity(start && end && start > end ? "La fecha final debe ser posterior o igual a la inicial" : "");
    if (!event.currentTarget.reportValidity()) return;
    const filters = new URLSearchParams();
    for (const [key, value] of values) {
      const text = String(value).trim();
      if (text) filters.set(key, text);
    }
    setRequest(previous => ({ filters: filters.toString(), offset: 0, revision: previous.revision + 1 }));
  }
  return <main className="container">
    <div className="page-title"><div><span>CONSULTA HISTÓRICA</span>
      <h1>Episodios cerrados y anulados</h1>
      <p>Pacientes dados de alta e ingresos anulados, conservados para consulta.</p>
    </div><button type="button" onClick={() => setRequest(previous => ({ ...previous, revision: previous.revision + 1 }))}>Actualizar historial</button></div>
    <form className="panel form-grid" aria-label="Filtros del historial de episodios" onSubmit={apply}
      onChange={event => (event.currentTarget.elements.namedItem("closed_to") as HTMLInputElement).setCustomValidity("")}
      onReset={event => {
        (event.currentTarget.elements.namedItem("closed_to") as HTMLInputElement).setCustomValidity("");
        setRequest(previous => ({ filters: "", offset: 0, revision: previous.revision + 1 }));
      }}>
      <label>Buscar por nombre, documento o episodio<input type="search" name="q" maxLength={100} placeholder="Nombre, documento o EP-23" /></label>
      <label>Estado<select name="status" defaultValue=""><option value="">Cerrados y anulados</option><option value="CLOSED">Cerrados</option><option value="ANNULLED">Anulados</option></select></label>
      <label>Cierre desde<input type="date" name="closed_from" /></label>
      <label>Cierre hasta<input type="date" name="closed_to" /></label>
      <p>Fechas de cierre en hora dominicana, incluidos ambos días. Usa EP- seguido del número para buscar solo por episodio.</p>
      <button type="submit">Aplicar filtros</button><button type="reset">Limpiar filtros</button>
    </form>
    {loading && <p role="status">Consultando historial…</p>}
    {error && <div role="alert"><p>No se pudo consultar el historial. {error}</p>
      <button type="button" onClick={() => setRequest(previous => ({ ...previous, revision: previous.revision + 1 }))}>Reintentar historial</button></div>}
    {data && <>
      <section className="history-summary"><article><strong>{data.total}</strong><span>Episodios encontrados</span></article></section>
      <section className="panel history-table">
        <p>Mostrando {episodes.length} de {data.total} episodios · Página {Math.floor(data.offset / pageSize) + 1}.</p>
        {episodes.length === 0 ? data.total > 0 ?
          <p>Esta página ya no contiene episodios. Vuelve a la página anterior o actualiza los filtros.</p> :
          request.filters ? <p>No hay coincidencias con los filtros aplicados.</p> :
          <div className="empty-state"><h2>No existen episodios históricos</h2><p>Los pacientes dados de alta aparecerán aquí.</p></div> : (
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
                    ? staffingAuditDate(closedEpisode.closed_at)
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
                    disabled={openingBlocked}
                    onClick={() => { if (!openingBlocked) void onOpenEpisode(closedEpisode.id); }}
                  >
                    Ver línea de tiempo
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        {openingBlocked && <p>Espera a que termine el guardado antes de abrir otro episodio.</p>}
        <nav className="patient-history-pagination" aria-label="Páginas del historial de episodios">
          <button type="button" disabled={data.offset === 0} onClick={() => setRequest(previous => ({ ...previous, offset: Math.max(0, previous.offset - pageSize) }))}>Página anterior</button>
          <button type="button" disabled={data.offset + pageSize >= data.total} onClick={() => setRequest(previous => ({ ...previous, offset: previous.offset + pageSize }))}>Página siguiente</button>
        </nav>
      </section>
    </>}
  </main>;
}
