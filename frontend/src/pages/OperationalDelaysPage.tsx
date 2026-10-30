import { useEffect, useState } from "react";
import { api, ApiError, getSessionRevision } from "../api/client";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { DelayClock, DelayStage, OperationalDelays, SessionUser } from "../types/clinical";
import { staffingAuditDate } from "../components/staffingAuditDate";
import PatientSearch from "../components/PatientSearch";
import { usePatientSearch } from "../hooks/usePatientSearch";

const stages: Record<DelayStage, { label: string; basis: string }> = {
  TRIAGE: { label: "Triaje sin registrar", basis: "Desde ingreso" },
  DOCTOR: { label: "Primer inicio de medicina", basis: "Desde registro de triaje" },
  NURSE: { label: "Primer inicio de enfermería", basis: "Desde registro de triaje" },
  LAB_COLLECTION: { label: "Obtención de muestra", basis: "Desde solicitud de muestra" },
  LAB_DELIVERY: { label: "Entrega de muestra", basis: "Desde obtención registrada" },
  LAB_RECEIPT: { label: "Recepción en laboratorio", basis: "Desde entrega registrada" },
  LAB_SUITABILITY: { label: "Aptitud de muestra", basis: "Desde recepción registrada" },
  LAB_REPLACEMENT: { label: "Nueva muestra por rechazo", basis: "Desde rechazo registrado" },
  LAB_RESULT: { label: "Publicación de resultado", basis: "Desde recepción y aptitud de todas las muestras requeridas" },
  LAB_REVIEW: { label: "Revisión médica del resultado", basis: "Desde publicación de la versión vigente" },
  LAB_LEGACY: { label: "Orden anterior pendiente", basis: "Desde creación de la orden; sin fases de muestras registradas" },
};

type Patient = OperationalDelays["patients"][number];
function pendingEntries(patient: Patient): { stage: DelayStage; minutes: number | null }[] {
  return [...(patient.triage.state === "PENDING" ? [{ stage: "TRIAGE" as const, minutes: patient.triage.minutes }] : []),
    ...patient.attention.filter(item => item.wait.state === "PENDING").map(item => ({ stage: item.discipline, minutes: item.wait.minutes })),
    ...patient.laboratory];
}
const pendingStages = (patient: Patient) => pendingEntries(patient).map(item => item.stage);
const duration = (value: number | null) => value === null ? "Sin dato fiable" : `${value} min`;
function overview(patient: Patient, stage: "ALL" | DelayStage) {
  const items = pendingEntries(patient).filter(item => stage === "ALL" || item.stage === stage);
  if (items.length === 0) return "Sin pendientes en las fases medidas";
  const known = items.filter(item => item.minutes !== null).sort((a, b) => b.minutes! - a.minutes!);
  const oldest = known[0];
  return `${items.length} ${items.length === 1 ? "pendiente registrado" : "pendientes registrados"} · ${oldest ? `Mayor antigüedad conocida: ${stages[oldest.stage].label} · ${duration(oldest.minutes)}` : "Sin duraciones fiables"}${oldest && items.length > known.length ? " · Hay tiempos sin dato fiable" : ""}`;
}
function clockText(value: DelayClock) {
  if (value.state === "BEFORE_TRIAGE") return "Aún sin triaje registrado";
  if (value.state === "COMPLETED" && value.minutes === null) return "Registrado · duración de espera no disponible";
  if (value.state === "COMPLETED") return `Registrado · espera finalizada: ${duration(value.minutes)}`;
  return `Pendiente · ${duration(value.minutes)}`;
}

type Props = { user: SessionUser; operations: PendingOperations; onOpenEpisode: (id: number) => void };
export default function OperationalDelaysPage(props: Props) {
  const eligible = props.user.role !== "ACCOUNT_ADMIN" && (props.user.role === "SUPERVISOR" || props.user.can_coordinate);
  if (!eligible) return <main className="container"><p role="alert">Se requiere supervisión o permiso de coordinación para consultar demoras.</p></main>;
  return <Board key={`${getSessionRevision()}:${props.user.username}:${props.user.role}:${props.user.can_coordinate}`} {...props} />;
}

function Board({ user, operations, onOpenEpisode }: Props) {
  const [data, setData] = useState<OperationalDelays | null>(null), [denied, setDenied] = useState(false);
  const [stage, setStage] = useState<"ALL" | DelayStage>("ALL"), [page, setPage] = useState(0);
  const search = usePatientSearch();
  const live = useLiveRefresh({ context: `${getSessionRevision()}:${user.username}:operational-delays`, paused: () => operations.hasPending(),
    load: async signal => {
      try {
        const value = await api<OperationalDelays>("/operations/delays", { signal });
        return () => { setData(value); setDenied(false); };
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) return () => { setData(null); setDenied(true); };
        throw error;
      }
    } });
  const refresh = live.refresh;
  useEffect(() => { void refresh(); }, [refresh]);
  const patients = data?.patients ?? [];
  const filtered = patients.filter(patient => (stage === "ALL" || pendingStages(patient).includes(stage)) && search.matches(patient.name, patient.episode_id));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
  const visible = filtered.slice(currentPage * 20, currentPage * 20 + 20);
  return <main className="container">
    <h1>Esperas y demoras por etapa</h1>
    <p>Episodios activos. Los tiempos parten de hechos registrados; no indican incumplimiento de un límite ni duración de un procedimiento.</p>
    <p>Actualización cada 15 segundos mientras esta pestaña esté visible. La asignación de un responsable no confirma el inicio de atención.</p>
    <button type="button" disabled={operations.hasPending()} onClick={() => void live.refresh()}>Actualizar tablero</button>
    {data && <p>Datos consultados: {staffingAuditDate(data.generated_at)}.</p>}
    {live.error && <p role="alert">No se pudo actualizar el tablero. Los datos anteriores pueden estar desactualizados. {live.error}</p>}
    {denied && <p role="alert">Ya no tienes acceso a este tablero. Los datos anteriores se han retirado.</p>}
    {!data && !denied && !live.error && <p>Cargando demoras…</p>}
    {data && <>
      <section className="supervisor-stats" aria-label="Pacientes con pendientes por fase">
        {(["TRIAGE", "DOCTOR", "NURSE", "LAB_RESULT", "LAB_REVIEW"] as const).map(key => <article key={key}>
          <strong>{patients.filter(patient => pendingStages(patient).includes(key)).length}</strong><span>{stages[key].label}</span>
        </article>)}
      </section>
      <p>Cada indicador cuenta pacientes, no muestras ni analíticas. Un paciente puede figurar en varias fases.</p>
      <label>Fase pendiente<select value={stage} onChange={event => { setStage(event.target.value as typeof stage); setPage(0); }}>
        <option value="ALL">Todos los episodios activos</option>
        {Object.entries(stages).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
      </select></label>
      <PatientSearch query={search.query} onChange={value => { search.setQuery(value); setPage(0); }} count={filtered.length} total={patients.length} unit="pacientes" />
      {filtered.length === 0 && <p>No hay episodios activos que coincidan con la búsqueda y la fase.</p>}
      {visible.map(patient => <details className="panel operational-delay-card" key={patient.episode_id}>
        <summary><strong>{patient.name} · EP-{patient.episode_id} · P{patient.priority} · {patient.area_name || "Sin área confirmada"}</strong>
          <span className="operational-delay-summary">Estancia: {duration(patient.stay_minutes)} · {overview(patient, stage)}.</span>
        </summary>
        <p>Ubicación física: {patient.location}. Estancia desde ingreso: {duration(patient.stay_minutes)}.</p>
        <p>Registro de triaje: {clockText(patient.triage)}.</p>
        {patient.attention.map(item => <p key={item.discipline}>
          {item.discipline === "DOCTOR" ? "Medicina" : "Enfermería"}: {clockText(item.wait)}.
          {item.owner ? ` Responsable actual: ${item.owner.display_name || item.owner.username} (${item.owner.username}).` : " Sin responsable confirmado."}
          {item.wait.state !== "BEFORE_TRIAGE" && " El tiempo corresponde al primer inicio desde triaje; un relevo no lo reinicia."}
        </p>)}
        <h2>Fases pendientes registradas</h2>
        {pendingStages(patient).length === 0 && <p>Sin pendientes en las fases que mide este tablero.</p>}
        {patient.triage.state === "PENDING" && <p>{stages.TRIAGE.label} · {duration(patient.triage.minutes)} · {stages.TRIAGE.basis}.</p>}
        {patient.attention.filter(item => item.wait.state === "PENDING").map(item => <p key={item.discipline}>{stages[item.discipline].label} · {duration(item.wait.minutes)} · {stages[item.discipline].basis}.</p>)}
        {patient.laboratory.map(item => <article className="operational-delay-item" key={`${item.stage}:${item.order_id}:${item.resource_id}`}>
          <h3>{stages[item.stage].label} · Orden #{item.order_id} · {item.title}</h3>
          <p>{duration(item.minutes)} · {stages[item.stage].basis}: {item.since ? staffingAuditDate(item.since) : "Sin fecha registrada"}.</p>
        </article>)}
        <button type="button" onClick={() => onOpenEpisode(patient.episode_id)}>Abrir episodio EP-{patient.episode_id}</button>
      </details>)}
      {filtered.length > 20 && <div className="page-actions">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Página anterior</button>
        <span>Página {currentPage + 1} de {Math.ceil(filtered.length / 20)}</span>
        <button type="button" disabled={(currentPage + 1) * 20 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Página siguiente</button>
      </div>}
    </>}
  </main>;
}
