import { useEffect, useState } from "react";
import { api, ApiError, getSessionRevision } from "../api/client";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import type { HandoverData, User } from "../types/clinical";
import type { PendingOperations } from "../hooks/usePendingOperations";
import PatientSearch from "../components/PatientSearch";
import { usePatientSearch } from "../hooks/usePatientSearch";
import { staffingAuditDate } from "../components/staffingAuditDate";
import ReevaluationDue from "../components/ReevaluationDue";
import { IdentityBadge } from "../components/PatientIdentity";

type Props = { user: User; operations: PendingOperations; onOpenEpisode: (id: number) => void };
export default function ShiftHandoverPage(props: Props) {
  if (props.user.role === "ACCOUNT_ADMIN" || (!["DOCTOR", "NURSE"].includes(props.user.role) && !props.user.can_coordinate)) return <main><p role="alert">Se requiere medicina, enfermería o coordinación.</p></main>;
  return <Board key={`${getSessionRevision()}:${props.user.username}:${props.user.role}:${props.user.can_coordinate}`} {...props} />;
}
function Board({ user, operations, onOpenEpisode }: {
  user: User; operations: PendingOperations; onOpenEpisode: (id: number) => void;
}) {
  const [data, setData] = useState<HandoverData | null>(null);
  const [denied, setDenied] = useState(false), [mine, setMine] = useState(true);
  const [area, setArea] = useState(""), [person, setPerson] = useState("");
  const search = usePatientSearch();
  const live = useLiveRefresh({ context: `${getSessionRevision()}:${user.username}:handover`, paused: () => operations.hasPending(),
    load: async signal => {
      try {
        const value = await api<HandoverData>("/care/handover", { signal });
        return () => { setData(value); setDenied(false); };
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) return () => { setData(null); setDenied(true); };
        throw error;
      }
    } });
  const refresh = live.refresh;
  useEffect(() => { void refresh(); }, [refresh]);
  const patients = data?.patients ?? [];
  const matches = patients.filter(p => search.matches(p.name, p.episode_id) && (!area || p.area_name === area)
    && (!mine || p.owners.some(o => o.discipline === user.role && (o.username === user.username || o.proposed_username === user.username)))
    && (!person || p.owners.some(o => o.username === person || o.proposed_username === person)));
  const people = [...new Set(patients.flatMap(p => p.owners.flatMap(o => [o.username, o.proposed_username])).filter((s): s is string => Boolean(s)))].sort();
  return <main className="container">
    <h1>Resumen para cambio de turno</h1>
    <p>Consultar no transfiere responsabilidad ni completa pendientes. El relevo se acepta en Colas y responsables.</p>
    <p>Actualización cada 15 segundos mientras la pestaña esté visible. Los seguimientos tras alta se consultan en sus bandejas.</p>
    <button onClick={() => void refresh()} disabled={operations.hasPending()}>Actualizar resumen</button>
    {data && <p>Datos consultados: {staffingAuditDate(data.generated_at)}.</p>}
    {live.error && <p role="alert">No se pudo actualizar. Los datos anteriores pueden estar desactualizados. {live.error}</p>}
    {denied && <p role="alert">Ya no tienes acceso a este resumen.</p>}
    {!data && !denied && !live.error && <p>Cargando resumen…</p>}
    <label><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} />Mis pacientes y relevos entrantes</label>
    <label>Área<select value={area} onChange={e => setArea(e.target.value)}><option value="">Todas las áreas</option>{[...new Set(patients.map(p => p.area_name).filter((s): s is string => Boolean(s)))].sort().map(a => <option key={a}>{a}</option>)}</select></label>
    <label>Profesional<select value={person} onChange={e => setPerson(e.target.value)}><option value="">Todos los profesionales</option>{people.map(p => <option key={p}>{p}</option>)}</select></label>
    <PatientSearch query={search.query} onChange={search.setQuery} count={matches.length} total={patients.length} unit="pacientes" />
    {data && matches.length === 0 && <p>No hay episodios activos que coincidan con los filtros.</p>}
    {matches.map(p => <article className="panel" key={p.episode_id}>
      <h2>{p.name} · EP-{p.episode_id} · P{p.priority}</h2><IdentityBadge status={p.identity_status} />
      <p>Ubicación física: {p.location}. Área de seguimiento: {p.area_name || "Sin área confirmada"}.</p>
      {(["DOCTOR", "NURSE"] as const).map(d => { const o = p.owners.find(o => o.discipline === d); return <p key={d}>{d === "DOCTOR" ? "Medicina" : "Enfermería"}: {o?.display_name || o?.username || "Sin responsable confirmado"}.{o?.username && o.active !== 1 && " Cuenta inactiva; revisar cobertura."}{o?.proposed_username && ` Relevo pendiente a ${o.proposed_name || o.proposed_username}; continúa el responsable anterior.`}</p>; })}
      <p>Consulta disponibilidad y cobertura actual en Colas y responsables.</p>
      <p>Tareas pendientes: medicina {p.tasks.MEDICAL} · enfermería {p.tasks.NURSING}. Incluyen las reevaluaciones indicadas abajo.</p>
      {p.reevaluations.map((r, i) => <div key={i}><p>{r.service === "MEDICAL" ? "Medicina" : "Enfermería"}: {r.title} · {staffingAuditDate(r.due_at)}</p><ReevaluationDue dueAt={r.due_at} pending /></div>)}
      <p>Laboratorio: {p.legacy_lab_orders} órdenes anteriores pendientes · {p.lab_results} analíticas pendientes de resultado · {p.lab_reviews} resultados vigentes pendientes de revisión médica.</p>
      <p>Alertas abiertas: {p.open_alerts}.</p>
      <button onClick={() => onOpenEpisode(p.episode_id)}>Abrir episodio EP-{p.episode_id}</button>
    </article>)}
  </main>;
}
