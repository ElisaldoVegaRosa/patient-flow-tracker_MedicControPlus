import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, getSessionRevision } from "../api/client";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import type { StaffHistoryData, User } from "../types/clinical";
import StaffingTimeline from "../components/StaffingTimeline";
import { staffingActions } from "../presentation/staffingLabels";

export default function StaffHistoryPage({ user, onBack }: { user: User; onBack: () => void }) {
  const [filters, setFilters] = useState("");
  const [page, setPage] = useState(1);
  const query = `${filters}${filters ? "&" : ""}page=${page}&page_size=20`;
  const context = `${getSessionRevision()}:${user.username}:${query}`;
  const [result, setResult] = useState<{ context: string; data: StaffHistoryData } | null>(null);
  const { refresh, error } = useLiveRefresh({ context: user.can_coordinate ? context : null, paused: () => false,
    load: async signal => {
      const data = await api<StaffHistoryData>(`/staff/changes?${query}`, { signal });
      return () => setResult({ context, data });
    },
  });
  useEffect(() => { void refresh(); }, [context, refresh]);
  const data = result?.context === context ? result.data : null;
  const options = result?.context.startsWith(`${getSessionRevision()}:${user.username}:`) ? result.data : undefined;
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const start = String(values.get("start_date") ?? "");
    const end = String(values.get("end_date") ?? "");
    const input = event.currentTarget.elements.namedItem("end_date") as HTMLInputElement;
    input.setCustomValidity(start && end && start > end ? "La fecha final debe ser posterior o igual a la inicial" : "");
    if (!event.currentTarget.reportValidity()) return;
    setFilters(new URLSearchParams([...values].filter(([, value]) => Boolean(value)) as [string, string][]).toString());
    setPage(1);
  }
  if (!user.can_coordinate) return <main className="container"><p>No tienes permiso para consultar el historial general de planificación.</p></main>;
  return <main className="container">
    <button type="button" onClick={onBack}>Volver a personal y turnos</button>
    <h1>Registros de planificación</h1><p>Historial completo de las cuentas dentro de tu permiso de coordinación. Fechas y horas de República Dominicana.</p>
    <form className="panel form-grid" aria-label="Filtros del historial" onSubmit={apply} onChange={event => {
      const input = event.currentTarget.elements.namedItem("end_date") as HTMLInputElement;
      input.setCustomValidity("");
    }}>
      <label>Desde<input name="start_date" type="date" /></label><label>Hasta<input name="end_date" type="date" /></label>
      <label>Turno<select name="shift_id" defaultValue=""><option value="">Todos los turnos</option>
        {options?.shifts.map(shift => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
      </select></label>
      <label>Participaciones del profesional<select name="professional_id" defaultValue=""><option value="">Todos los profesionales</option>
        {options?.professionals.map(person => <option key={person.id} value={person.id}>{person.display_name || person.username} ({person.username})</option>)}
      </select></label>
      <label>Tipo de cambio<select name="action" defaultValue=""><option value="">Todos los cambios</option>
        {Object.entries(staffingActions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button type="submit">Aplicar filtros</button><button type="reset" onClick={() => { setFilters(""); setPage(1); }}>Limpiar filtros</button>
    </form>
    <button type="button" onClick={() => void refresh()}>Actualizar registros</button>
    <p>Actualización cada 15 segundos mientras la pestaña esté visible.</p>
    {error && <p role="alert">No se pudo actualizar el historial. {error}</p>}
    {!data && !error && <p role="status">Consultando registros…</p>}
    {data && <><p>{data.total} registros encontrados · Página {data.page}</p>
      <StaffingTimeline changes={data.changes} />
      <nav aria-label="Páginas del historial"><button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button>
        <button type="button" disabled={!data.has_more} onClick={() => setPage(value => value + 1)}>Siguiente</button></nav>
    </>}
  </main>;
}
