import ReevaluationDue, { ReevaluationSummary } from "../components/ReevaluationDue";
import { staffingAuditDate } from "../components/staffingAuditDate";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, getSessionRevision, isSessionInterruption } from "../api/client";
import OperationalWriteForm from "../components/OperationalWriteForm";
import { notifyOperationalConfirmation, OPERATION_CONFIRMED_EVENT, operationalFormDirty } from "../session/operationalWrites";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { CareEpisode, CarePerson, CareQueue, CareSlot, User } from "../types/clinical";

const roleLabel = (role: string) => role === "DOCTOR" ? "Medicina" : "Enfermería";
const personLabel = (person: Pick<CarePerson, "display_name" | "username"> | null) => person ? `${person.display_name || person.username} (${person.username})` : "Sin responsable confirmado";
const minutes = (value?: number | null) => value == null ? "Sin dato fiable" : `${value} min`;
function payload(fields: FormData) {
  const value: Record<string, unknown> = Object.fromEntries(fields);
  for (const name of ["user_id", "area_id"]) if (name in value) value[name] = Number(value[name]);
  return value;
}

export default function CareQueuePage({ user, operations, onOpenEpisode }: {
  user: User; operations: PendingOperations; onOpenEpisode: (id: number) => void;
}) {
  const [data, setData] = useState<CareQueue | null>(null);
  const dataRef = useRef<CareQueue | null>(null);
  const root = useRef<HTMLElement>(null);
  const mounted = useRef(true);
  const [dirty, setDirty] = useState(false);
  const [dirtyForms, setDirtyForms] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [area, setArea] = useState("");
  const [mine, setMine] = useState(false);
  const [history, setHistory] = useState<CareEpisode | null>(null);
  const manualRead = useRef(0);
  const historyRead = useRef(0);
  function updateDirty() {
    const forms = [...(root.current?.querySelectorAll<HTMLFormElement>("form[data-operational]") ?? [])].filter(operationalFormDirty);
    setDirty(forms.length > 0);
    setDirtyForms(forms.map(form => `${form.closest("article[aria-label]")?.getAttribute("aria-label") ?? ""} · ${form.querySelector("legend")?.textContent ?? "Formulario"}`));
  }
  async function load(signal?: AbortSignal): Promise<CareQueue> {
    const next = await api<CareQueue>("/care/queue", { signal });
    // Keep mounted forms when another session closes an episode; current fields survive.
    const removed = (dataRef.current?.episodes ?? []).filter(previous => !next.episodes.some(item => item.episode_id === previous.episode_id));
    const archived = await Promise.all(removed.map(previous => api<CareEpisode>(`/care/episodes/${previous.episode_id}`, { signal })));
    return { ...next, episodes: [...next.episodes, ...archived] };
  }
  function apply(value: CareQueue) { dataRef.current = value; setData(value); }
  const { refresh, error: liveError } = useLiveRefresh({
    context: `${getSessionRevision()}:${user.username}:care`,
    paused: () => dirty || operations.hasPending(),
    load: async signal => {
      const serial = ++manualRead.current;
      const value = await load(signal);
      return () => { if (serial === manualRead.current) apply(value); };
    },
  });
  async function reload() {
    const revision = getSessionRevision(), serial = ++manualRead.current;
    try {
      const value = await load();
      if (mounted.current && revision === getSessionRevision() && serial === manualRead.current) { apply(value); setError(""); }
    } catch (exception) {
      if (mounted.current && revision === getSessionRevision() && serial === manualRead.current && !isSessionInterruption(exception)) setError((exception as Error).message);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);
  useEffect(() => {
    const confirmed = (event: Event) => {
      if (!(event as CustomEvent<{ path: string }>).detail.path.startsWith("/care/")) return;
      setNotice("Operación confirmada. Asignar o aceptar relevo no registra una evaluación clínica.");
      void reload();
    };
    window.addEventListener(OPERATION_CONFIRMED_EVENT, confirmed);
    return () => window.removeEventListener(OPERATION_CONFIRMED_EVENT, confirmed);
  });
  async function inspect(id: number) {
    const revision = getSessionRevision();
    const serial = ++historyRead.current;
    try {
      const value = await api<CareEpisode>(`/care/episodes/${id}`);
      if (mounted.current && revision === getSessionRevision() && serial === historyRead.current) { setHistory(value); setError(""); }
    } catch (exception) {
      if (mounted.current && revision === getSessionRevision() && serial === historyRead.current && !isSessionInterruption(exception)) setError((exception as Error).message);
    }
  }
  function inspectForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = Number(new FormData(event.currentTarget).get("episode_id"));
    if (Number.isSafeInteger(id) && id > 0) void inspect(id);
  }
  const common = { operations, method: "POST" as const, transform: payload, conflictNoun: "responsabilidad",
    onDirty: updateDirty, onConflict: () => void reload(),
    onApplied: (path: string, _result: unknown, body?: BodyInit | null) => notifyOperationalConfirmation(path, body) };
  const owns = (slot: CareSlot) => slot.owner?.username === user.username && slot.discipline === user.role;
  const proposed = (slot: CareSlot) => slot.proposed?.username === user.username && slot.discipline === user.role;
  function candidates(slot: CareSlot, self = false) {
    return <label>Profesional receptor<select name="user_id" required defaultValue="">
      <option value="">Selecciona una cuenta disponible</option>
      {slot.candidates.filter(item => (!self || item.username === user.username) && item.id !== slot.user_id).map(item =>
        <option key={item.id} value={item.id}>{personLabel(item)}</option>)}
    </select></label>;
  }
  function card(item: CareEpisode) {
    const active = item.status === "ACTIVE";
    const route = user.can_coordinate || item.slots.some(owns) || (user.role === "NURSE" && item.area_id === null && item.slots.every(slot => slot.user_id === null));
    return <article className="panel" key={item.episode_id} aria-label={`Seguimiento EP-${item.episode_id}`}
      hidden={Boolean((area && String(item.area_id ?? "") !== area) || (mine && !item.slots.some(slot => owns(slot) || proposed(slot))))}>
      {active && <ReevaluationSummary actions={item.reevaluations ?? []} />}
      <details className="operational-disclosure"><summary><h2>{item.name} · EP-{item.episode_id} · P{item.priority} · {item.area_name || "Sin área confirmada"}</h2></summary>
      <p>Estado del episodio: {item.status}. Ubicación física: {item.location}. Área de seguimiento: {item.area_name || "Sin área confirmada"}.</p>
      <p>Desde ingreso: {minutes(item.since_arrival_minutes)}. Desde fin de triaje: {minutes(item.since_ready_minutes)}.</p>
      {item.historical === 1 && <p>Registro anterior: no se infiere inicio de atención ni responsables a partir del texto previo.</p>}
      <p>Referencia previa, sin asignación confirmada por ese texto: {item.legacy_assigned_to || "Sin referencia"}.</p>
      <p>Órdenes LAB pendientes: {item.lab_pending ?? "Consultar episodio"}. Son dependencias, no tareas propias de medicina o enfermería.</p>
      {(item.reevaluations ?? []).filter(action => action.status === "PENDING").map(action => <div key={action.id}>
        <p><strong>{action.service === "MEDICAL" ? "Medicina" : "Enfermería"}: {action.title}</strong> · {staffingAuditDate(action.due_at)}</p>
        <p>Responsable: {action.owner_name || action.owner_username || "Sin responsable confirmado"}</p>
        <ReevaluationDue dueAt={action.due_at} pending={active} />
      </div>)}
      <p>Alertas abiertas: {item.open_alert_count ?? "Consultar episodio"}. Consulta el episodio para valorar su contexto.</p>
      {!active && <p role="status">Episodio finalizado. Los campos locales se conservan para consulta; no se pueden enviar.</p>}
      <button type="button" onClick={() => onOpenEpisode(item.episode_id)}>Abrir episodio EP-{item.episode_id}</button>
      <button type="button" onClick={() => void inspect(item.episode_id)}>Consultar historial EP-{item.episode_id}</button>
      {(user.can_coordinate || user.role === "NURSE" || user.role === "DOCTOR") && <details><summary>Área de seguimiento y traslado</summary>
        <OperationalWriteForm {...common} path={`/care/episodes/${item.episode_id}/area`} version={item.version} blocked={!active || !route} label="Confirmar área de seguimiento">
          <label>Área de seguimiento<select name="area_id" required defaultValue={item.area_id ?? ""}><option value="">Selecciona área</option>
            {data?.areas.filter(value => value.active).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}
          </select></label>
          <p>No cambia ubicación física ni responsable. El médico normalmente permanece; enfermería requiere relevo aceptado para cambiar.</p>
        </OperationalWriteForm>
      </details>}
      {item.slots.map(slot => {
        const base = `/care/episodes/${item.episode_id}/${slot.discipline}`;
        const allowed = user.can_coordinate || owns(slot);
        return <section key={slot.discipline} aria-label={`${roleLabel(slot.discipline)} EP-${item.episode_id}`}>
          <details className="operational-disclosure"><summary><h3>{roleLabel(slot.discipline)} · {personLabel(slot.owner)}{slot.needs_coverage ? " · Cobertura pendiente" : ""}{slot.proposed ? " · Relevo pendiente" : ""}</h3></summary>
          <p>Responsable confirmado: {personLabel(slot.owner)}.</p>
          <p>Inicio con el responsable actual: {slot.started_at || "Sin confirmar"}. Espera hasta primer inicio: {minutes(slot.waiting_minutes)}.</p>
          {slot.first_started_at && <p>Primer inicio operacional registrado: {slot.first_started_at}. Un relevo no borra ese hecho.</p>}
          {active && slot.needs_coverage && <p role="status">Cobertura pendiente: falta responsable o revisar cuenta, área, turno y disponibilidad. La responsabilidad anterior se conserva.</p>}
          {slot.proposed && <p>Relevo propuesto a {personLabel(slot.proposed)}. Hasta aceptar, sigue responsable {personLabel(slot.owner)}.</p>}
          <details><summary>Candidatos y explicación del reparto</summary>
            <p>Orden: menos P1/P2, pendientes propios, total activo y mayor tiempo sin asignación. La recomendación requiere confirmación humana.</p>
            {slot.candidates.length === 0 && <p>No hay candidatos disponibles compatibles; el paciente sigue visible.</p>}
            {slot.candidates.map((candidate, index) => <p key={candidate.id}>
              {index === 0 ? "Sugerido: " : "Alternativa: "}{personLabel(candidate)} · P1/P2: {candidate.high_priority};
              tareas propias: {candidate.pending_tasks}; total activo: {candidate.total}; relevos entrantes pendientes: {candidate.incoming};
              desglose P1–P5: {[1, 2, 3, 4, 5].map(priority => `P${priority}: ${candidate.by_priority[String(priority)] ?? 0}`).join(", ")};
              última asignación: {candidate.last_assignment_at || "Aún sin asignaciones"}.
            </p>)}
          </details>
          {(user.can_coordinate || user.role === slot.discipline) && <OperationalWriteForm {...common}
            path={`${base}/assign`} version={item.version} blocked={!active || !item.area_id || Boolean(slot.owner)} label={`Confirmar responsable de ${roleLabel(slot.discipline)}`}>
            {candidates(slot, !user.can_coordinate)}<p>Confirmar no registra inicio de atención.</p>
          </OperationalWriteForm>}
          {user.role === slot.discipline && <OperationalWriteForm {...common} path={`${base}/start`} version={item.version}
            blocked={!active || !owns(slot) || Boolean(slot.started_at) || !slot.covered} label={`Confirmar inicio de ${roleLabel(slot.discipline)}`}>
            <p>Solo confirma tu inicio. No publica evaluación, signos ni resultados.</p>
          </OperationalWriteForm>}
          {(user.can_coordinate || user.role === slot.discipline) && <details><summary>Proponer relevo de {roleLabel(slot.discipline)}</summary>
            <OperationalWriteForm {...common} path={`${base}/handoff`} version={item.version} blocked={!active || !slot.owner || !allowed || Boolean(slot.proposed)} label={`Proponer relevo de ${roleLabel(slot.discipline)}`}>
              {candidates(slot)}<p>El responsable anterior continúa hasta que el receptor acepte.</p>
            </OperationalWriteForm>
          </details>}
          {user.role === slot.discipline && <OperationalWriteForm {...common} path={`${base}/accept`} version={item.version} blocked={!active || !proposed(slot)} label={`Aceptar relevo de ${roleLabel(slot.discipline)}`}>
            <p>Aceptas responsabilidad; el inicio con tu cuenta se confirma por separado.</p>
          </OperationalWriteForm>}
          {(user.can_coordinate || user.role === slot.discipline) && <OperationalWriteForm {...common} path={`${base}/cancel-handoff`} version={item.version} blocked={!active || !slot.proposed || !(allowed || proposed(slot))} label={`Cancelar o rechazar relevo de ${roleLabel(slot.discipline)}`}>
            <p>Conserva al responsable anterior y registra el motivo.</p>
          </OperationalWriteForm>}
          {user.can_coordinate && <details><summary>Excepción de coordinación de {roleLabel(slot.discipline)}</summary>
            <OperationalWriteForm {...common} path={`${base}/override`} version={item.version} blocked={!active || !slot.owner} label={`Resolver excepción de ${roleLabel(slot.discipline)}`}>
              {candidates(slot)}<p>Sustituye al responsable sin aceptación del receptor. Usa solo una excepción justificada; queda auditada expresamente.</p>
            </OperationalWriteForm>
          </details>}
        </details></section>;
      })}
    </details></article>;
  }
  return <main className="container" ref={root}>
    <h1>Colas y responsables</h1>
    <p>Prioridad vigente y antigüedad desde triaje. Sugerencia, asignación e inicio son hechos separados. No acredita evaluación clínica.</p>
    <button type="button" disabled={operations.hasPending()} onClick={() => void reload()}>Consultar colas actuales</button>
    <p>{dirty ? "Actualización automática pausada mientras editas." : "Actualización cada 15 segundos mientras la pestaña esté visible."}</p>
    {dirtyForms.length > 0 && <div role="status" className="panel">
      <p>Campos sin guardar en {dirtyForms.join("; ")}. Abre ese paciente y formulario para revisarlos o descartarlos. Consultar colas no los envía.</p>
    </div>}
    {notice && <p role="status">{notice}</p>}{(error || liveError) && <p role="alert">{error || liveError}</p>}
    <label>Mostrar cola<select value={String(mine)} onChange={event => setMine(event.target.value === "true")}><option value="false">Cola compartida</option><option value="true">Mi cola y relevos entrantes</option></select></label>
    <label>Filtrar área de seguimiento<select value={area} onChange={event => setArea(event.target.value)}><option value="">Todas, incluidas sin área</option>
      {data?.areas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {!data && <p role="status">Consultando colas…</p>}
    {data?.episodes.length === 0 && <p>No hay episodios activos con triaje registrado.</p>}
    {data?.episodes.map(card)}
    <section className="panel"><details className="operational-disclosure"><summary><h2>Consultar responsables anteriores</h2></summary>
      <form onSubmit={inspectForm}><label>Número de episodio<input name="episode_id" type="number" min="1" required /></label><button>Consultar responsables e historial</button></form>
      {history && <><h3>Historial EP-{history.episode_id} · {history.status}</h3>
        {history.slots.map(slot => <p key={slot.discipline}>{roleLabel(slot.discipline)}: {personLabel(slot.owner)}; inicio actual: {slot.started_at || "Sin confirmar"}.</p>)}
        {history.changes?.length === 0 && <p>Sin cambios de responsabilidad registrados.</p>}
        {history.changes?.map(change => <article key={change.id}><h4>{change.action} · {change.discipline ? roleLabel(change.discipline) : "Área"}</h4>
          <p>{change.actor} · {change.created_at}</p><p>Motivo: {change.reason}</p><details><summary>Valores anteriores y nuevos</summary>
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{change.old_value}</pre><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{change.new_value}</pre>
          </details></article>)}
      </>}
    </details></section>
  </main>;
}
