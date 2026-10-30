import { useEffect, useRef, useState } from "react";
import { api, isSessionInterruption } from "../api/client";
import type { FollowupPerson, LaboratoryFollowup, LaboratoryFollowupHistory, FollowupHistorySnapshot, SessionUser } from "../types/clinical";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { SampleApplied } from "./SpecimenWorkPanel";
import OperationalWriteForm from "./OperationalWriteForm";
import StaffDateTimeInput from "./StaffDateTimeInput";
import { staffingAuditDate, staffingDatePayload } from "./staffingAuditDate";
import { readSpecimenDraft, saveSpecimenDraft } from "../session/specimenDrafts";

const person = (value: FollowupPerson | null) => value ? `${value.display_name || value.username} (${value.username})` : "Sin responsable";
const names = { plan: "Actualizar plan de seguimiento", propose: "Proponer relevo del seguimiento", accept: "Aceptar responsabilidad del seguimiento", "cancel-handoff": "Cancelar o rechazar relevo del seguimiento" };
type Action = keyof typeof names;
function FollowupAction({ action, item, user, doctors, operations, blocked, onApplied, onConflict, onDirty }: {
  action: Action; item: LaboratoryFollowup; user: SessionUser; doctors: FollowupPerson[];
  operations: PendingOperations; blocked: boolean; onApplied: SampleApplied; onConflict: () => void; onDirty: () => void;
}) {
  const path = `/lab/followups/${item.id}/${action}`;
  const [saved] = useState(() => readSpecimenDraft(user, path));
  const [warning, setWarning] = useState(saved.warning);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function payload(fields: FormData) {
    const values = staffingDatePayload(fields);
    return { reason: values.reason, ...(action === "plan" ? { review_due_at: values.due_at, communication_plan: values.communication_plan } : {}),
      ...(action === "propose" ? { user_id: Number(values.user_id) } : {}) };
  }
  return <details><summary>{names[action]}</summary>
    {blocked && <p>Esta acción no está disponible en el estado actual. Los campos anteriores se conservan para revisión.</p>}
    {warning && <p role="alert">{warning}</p>}
    <OperationalWriteForm {...{ path, operations }} version={item.version} label={names[action]} blocked={blocked || !item.version}
      transform={payload} conflictNoun="seguimiento" initialDraft={saved.draft}
      onDraft={(version, fields, dirty) => setWarning(saveSpecimenDraft(user, path, version, fields, dirty))} onDirty={onDirty}
      onApplied={(...args) => { if (mounted.current) onApplied(...args); }} onConflict={() => { if (mounted.current) onConflict(); }}>
      {action === "plan" && <>
        <StaffDateTimeInput name="due_at" label="Fecha de revisión · hora dominicana" value={item.review_due_at ?? undefined} />
        <label>Cómo se informará al paciente<textarea name="communication_plan" required minLength={3} maxLength={2000} defaultValue={item.communication_plan ?? ""} /></label>
      </>}
      {action === "propose" && <>
        <p>El responsable actual continúa hasta que el receptor acepte.</p>
        <label>Médico receptor<select name="user_id" required defaultValue=""><option value="">Selecciona una cuenta médica activa</option>
          {doctors.filter(value => value.id !== item.owner_user_id).map(value => <option key={value.id} value={value.id}>{person(value)}</option>)}
        </select></label>
      </>}
      {action === "accept" && <p>Aceptas el seguimiento de estas analíticas. Los resultados siguen requiriendo revisión expresa de cada versión.</p>}
      {action === "cancel-handoff" && <p>El responsable actual se conserva. Se registra el motivo de cancelar o rechazar el relevo.</p>}
    </OperationalWriteForm>
  </details>;
}

export default function LaboratoryFollowupCard({ item, user, doctors = [], operations, onApplied, onConflict, onDirty, onOpenEpisode }: {
  item: LaboratoryFollowup; user: SessionUser; doctors?: FollowupPerson[]; operations: PendingOperations;
  onApplied: SampleApplied; onConflict: () => void; onDirty: () => void; onOpenEpisode?: (id: number) => void;
}) {
  if (!["DOCTOR", "NURSE", "LAB", "SUPERVISOR"].includes(user.role)) return null;
  const owns = user.role === "DOCTOR" && item.owner?.username === user.username;
  const receives = user.role === "DOCTOR" && item.proposed?.username === user.username;
  const coordinates = Boolean(user.can_coordinate);
  const active = item.current_cycle && item.episode_status === "CLOSED";
  const canPropose = owns || coordinates;
  const common = { item, user, doctors, operations, onApplied, onConflict, onDirty };
  return <article className="panel" data-followup-id={item.id} aria-label={`Seguimiento EP-${item.episode_id}`}>
    <details><summary>{item.patient_name} · EP-{item.episode_id} · Seguimiento tras alta</summary>
      <p>Responsable: {person(item.owner)}.</p>
      {item.proposed && <p>Relevo propuesto a: {person(item.proposed)}. El responsable anterior continúa hasta la aceptación.</p>}
      <p>Resultados pendientes: {item.pending_results} · Revisiones pendientes: {item.pending_reviews}.</p>
      <p>Revisión prevista: {item.review_due_at ? `${staffingAuditDate(item.review_due_at)} · hora dominicana` : "Sin plan registrado"}.</p>
      {item.communication_plan && <p>Comunicación al paciente: {item.communication_plan}</p>}
      {item.requires_plan && <p role="status">Falta registrar un plan para el trabajo pendiente.</p>}
      {item.coverage_pending && <p role="status">Cobertura pendiente: se requiere un médico responsable activo.</p>}
      {item.overdue && <p role="status">Fecha de revisión vencida. Consulta los pendientes y actualiza el seguimiento.</p>}
      {!item.clinical_work_pending && <p>Sin resultados ni revisiones pendientes. La custodia y el historial se conservan.</p>}
      {!active && <p>Seguimiento de un ciclo anterior: solo consulta.</p>}
      {onOpenEpisode && <button type="button" disabled={operations.hasPending()} onClick={() => onOpenEpisode(item.episode_id)}>Abrir episodio EP-{item.episode_id}</button>}
      {owns && <FollowupAction {...common} action="plan" blocked={!active} />}
      {canPropose && <FollowupAction {...common} action="propose" blocked={!active || item.pending_user_id !== null || !doctors.some(value => value.id !== item.owner_user_id)} />}
      {receives && <FollowupAction {...common} action="accept" blocked={!active} />}
      {(owns || receives || coordinates) && <FollowupAction {...common} action="cancel-handoff" blocked={!active || item.pending_user_id === null} />}
      <FollowupHistory id={item.id} version={item.version} />
    </details>
  </article>;
}

function Snapshot({ value }: { value: FollowupHistorySnapshot | null }) {
  if (!value) return <p>Sin registro anterior.</p>;
  return <><p>Responsable: {person(value.owner)}.</p><p>Receptor propuesto: {person(value.proposed)}.</p>
    <p>Fecha prevista: {value.review_due_at ? staffingAuditDate(value.review_due_at) : "Sin fecha"}.</p>
    <p>Comunicación: {value.communication_plan || "Sin plan registrado"}.</p></>;
}
function FollowupHistory({ id, version }: { id: number; version: string }) {
  const [open, setOpen] = useState(false), [offset, setOffset] = useState(0);
  const [state, setState] = useState<{ key: string; data: LaboratoryFollowupHistory | null; error: string }>({ key: "", data: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${id}:${version}:${offset}:${attempt}`;
  const loading = open && state.key !== requestKey;
  const data = state.key === requestKey ? state.data : null;
  const error = state.key === requestKey ? state.error : "";
  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    void api<LaboratoryFollowupHistory>(`/lab/followups/${id}/history?limit=20&offset=${offset}`, { signal: controller.signal })
      .then(value => { if (active) setState({ key: requestKey, data: value, error: "" }); })
      .catch(exception => { if (active && !isSessionInterruption(exception)) setState({ key: requestKey, data: null, error: (exception as Error).message }); });
    return () => { active = false; controller.abort(); };
  }, [open, id, offset, requestKey]);
  const actionNames: Record<string, string> = { DISCHARGE: "Alta con custodia", PLAN: "Plan actualizado", PROPOSE: "Relevo propuesto", ACCEPT: "Relevo aceptado", CANCEL_HANDOFF: "Relevo cancelado o rechazado" };
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Historial del seguimiento</summary>
    {loading && <p>Consultando historial…</p>}
    {error && <p role="alert">No se pudo actualizar el historial: {error}</p>}
    {error && <button type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar historial</button>}
    {!loading && !error && data?.items.map(item => <article key={item.id}>
      <h4>{actionNames[item.action] ?? "Cambio de seguimiento"}</h4>
      <p>{item.username} · {staffingAuditDate(item.created_at)} · Motivo: {item.reason}</p>
      <details><summary>Ver cambios anteriores y nuevos</summary><h5>Anterior</h5><Snapshot value={item.previous} /><h5>Nuevo</h5><Snapshot value={item.next} /></details>
    </article>)}
    {!loading && !error && data?.items.length === 0 && <p>No hay registros en esta página.</p>}
    <button type="button" disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>Historial anterior</button>
    <button type="button" disabled={loading || Boolean(error) || !data?.has_more} onClick={() => setOffset(value => value + 20)}>Más registros del historial</button>
  </details>;
}
