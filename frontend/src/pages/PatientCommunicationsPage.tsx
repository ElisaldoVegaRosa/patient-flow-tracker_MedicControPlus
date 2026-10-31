import { useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { api, ApiError, getSessionRevision, getWriteRevision, isSessionInterruption } from "../api/client";
import type { CommunicationCase, CommunicationEvent, CommunicationQueue, SessionUser } from "../types/clinical";
import type { PendingOperations } from "../hooks/usePendingOperations";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import OperationalWriteForm from "../components/OperationalWriteForm";
import StaffDateTimeInput from "../components/StaffDateTimeInput";
import { staffingAuditDate, staffingDatePayload } from "../components/staffingAuditDate";
import { notifyOperationalConfirmation, OPERATION_CONFIRMED_EVENT, operationalFormDirty } from "../session/operationalWrites";
import { readSpecimenDraft, saveSpecimenDraft } from "../session/specimenDrafts";

const channelNames = { PHONE: "Llamada telefónica", IN_PERSON: "Presencial", WHATSAPP: "WhatsApp institucional" };
const outcomeNames = { NO_RESPONSE: "Sin respuesta", SENT: "Enviado sin respuesta", READ: "Leído sin respuesta", CONFIRMED: "Respuesta e identidad verificadas" };
const eventNames = { ATTEMPT: "Gestión de contacto", EXPLAIN: "Explicación clínica registrada", RECTIFY: "Rectificación" };
type Props = { user: SessionUser; operations: PendingOperations };
export default function PatientCommunicationsPage(props: Props) {
  const allowed = ["RECEPTION", "DOCTOR", "SUPERVISOR"].includes(props.user.role) || (["NURSE", "LAB"].includes(props.user.role) && props.user.can_coordinate);
  if (!allowed) return <main className="container"><p role="alert">No tienes acceso a la gestión de contacto.</p></main>;
  return <Board key={`${getSessionRevision()}:${props.user.username}:${props.user.role}:${props.user.can_coordinate}`} {...props} />;
}
function Board({ user, operations }: Props) {
  const [data, setData] = useState<CommunicationQueue | null>(null), [denied, setDenied] = useState(false);
  const [resolved, setResolved] = useState(false), [offset, setOffset] = useState(0), [dirty, setDirty] = useState(false);
  const root = useRef<HTMLElement>(null);
  const dataRef = useRef<CommunicationQueue | null>(null), serial = useRef(0), mounted = useRef(true);
  const [manualError, setManualError] = useState("");
  const apply = (value: CommunicationQueue) => { dataRef.current = value; setData(value); setDenied(false); setManualError(""); };
  const formsDirty = () => [...root.current?.querySelectorAll<HTMLFormElement>("form[data-operational]") ?? []].some(operationalFormDirty);
  const updateDirty = () => setDirty(formsDirty());
  async function read(signal?: AbortSignal) {
    const value = await api<CommunicationQueue>(`/communications?include_resolved=${resolved}&offset=${offset}`, { signal });
    const dirtyIds = new Set([...root.current?.querySelectorAll<HTMLFormElement>("form[data-operational]") ?? []].filter(operationalFormDirty)
      .map(form => Number(form.closest("[data-contact-id]")?.getAttribute("data-contact-id"))));
    const removed = (dataRef.current?.items ?? []).filter(item => dirtyIds.has(item.followup_id) && !value.items.some(current => current.followup_id === item.followup_id));
    const retained = await Promise.all(removed.map(item => api<CommunicationCase>(`/communications/${item.followup_id}`, { signal })));
    return { ...value, items: [...value.items, ...retained] };
  }
  async function reload() {
    const ticket = ++serial.current, session = getSessionRevision(), writes = getWriteRevision();
    try {
      const value = await read();
      if (mounted.current && serial.current === ticket && session === getSessionRevision() && writes === getWriteRevision()) apply(value);
    } catch (error) {
      if (!mounted.current || serial.current !== ticket || session !== getSessionRevision() || isSessionInterruption(error)) return;
      if (error instanceof ApiError && error.status === 403) { dataRef.current = null; setData(null); setDenied(true); }
      else setManualError((error as Error).message);
    }
  }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const confirmed = (event: Event) => {
      if ((event as CustomEvent<{ path: string }>).detail?.path?.startsWith("/communications/")) void reload();
    };
    window.addEventListener(OPERATION_CONFIRMED_EVENT, confirmed);
    return () => window.removeEventListener(OPERATION_CONFIRMED_EVENT, confirmed);
  });
  const live = useLiveRefresh({ context: `${getSessionRevision()}:${user.username}:communications:${resolved}:${offset}`,
    paused: () => operations.hasPending() || formsDirty(), load: async signal => {
      try {
        const ticket = ++serial.current;
        const value = await read(signal);
        return () => { if (serial.current === ticket) apply(value); };
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) return () => { setData(null); setDenied(true); };
        throw error;
      }
    } });
  const refresh = live.refresh;
  useEffect(() => { void refresh(); }, [refresh, resolved, offset]);
  useEffect(() => {
    const observer = new MutationObserver(() => setDirty([...root.current?.querySelectorAll<HTMLFormElement>("form[data-operational]") ?? []].some(operationalFormDirty)));
    if (root.current) observer.observe(root.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return <main ref={root} className="container">
    <h1>Contacto tras el alta</h1>
    <p>Registro manual. No envía mensajes ni realiza llamadas. El número se consulta en el registro habitual del centro.</p>
    <p>Contactar, transmitir un aviso y explicar clínicamente son hechos separados. WhatsApp institucional se limita a avisos de contacto.</p>
    <button type="button" disabled={operations.hasPending()} onClick={() => void reload()}>Actualizar contactos</button>
    {live.updated && <p>Última consulta: {staffingAuditDate(new Date(live.updated).toISOString())}.</p>}
    {dirty && <p role="status">Hay campos sin guardar. La actualización automática está en pausa; revisar datos actuales conserva los campos.</p>}
    {(live.error || manualError) && <p role="alert">No se pudo actualizar. Los datos anteriores pueden estar desactualizados. {live.error || manualError}</p>}
    {denied && <p role="alert">El acceso cambió. Se retiraron los datos anteriores.</p>}
    {data && !data.enabled && <p role="status">Registro de comunicación todavía no habilitado en esta base. Requiere preparar una copia con respaldo antes del ensayo.</p>}
    {data?.enabled && <>
      <label><input type="checkbox" checked={resolved} disabled={dirty || operations.hasPending()} onChange={e => { setResolved(e.target.checked); setOffset(0); }} />Incluir contactos y explicaciones completados</label>
      <p>Seguimientos que coinciden: {data.total}. Actualización cada 15 segundos mientras la pestaña esté visible.</p>
      {data.items.length === 0 && <p>No hay contactos autorizados pendientes en esta página.</p>}
      {data.items.map(item => <Card key={item.followup_id} {...{ item, user, operations }} onDirty={updateDirty} refresh={() => void reload()} />)}
      <button type="button" disabled={dirty || operations.hasPending() || offset === 0} onClick={() => setOffset(offset - 20)}>Página anterior</button>
      <button type="button" disabled={dirty || operations.hasPending() || !data.has_more} onClick={() => setOffset(offset + 20)}>Página siguiente</button>
    </>}
  </main>;
}
type CardProps = Props & { item: CommunicationCase; onDirty: () => void; refresh: () => void };
function ContactForm({ user, draftId, ...props }: ComponentProps<typeof OperationalWriteForm> & { user: SessionUser; draftId?: number }) {
  const draftPath = props.path + (draftId ? `/${draftId}` : "");
  const [saved] = useState(() => readSpecimenDraft(user, draftPath));
  const [warning, setWarning] = useState(saved.warning);
  return <>{warning && <p role="alert">{warning}</p>}<OperationalWriteForm {...props} initialDraft={saved.draft}
    onDraft={(baseline, fields, dirty) => setWarning(saveSpecimenDraft(user, draftPath, baseline, fields, dirty))} /></>;
}
function Card({ item, operations, user, onDirty, refresh }: CardProps) {
  const [mode, setMode] = useState(() => readSpecimenDraft(user, `/communications/${item.followup_id}/authorize`).draft?.fields.mode ?? "CONTACT_ONLY");
  const applied = (path: string, _result: unknown, body?: BodyInit | null) => { notifyOperationalConfirmation(path, body); if (path.endsWith("/authorize")) setMode("CONTACT_ONLY"); };
  const common = { user, operations, version: item.version, onDirty, onConflict: refresh, onApplied: applied, conflictNoun: "aviso o seguimiento" };
  const prefix = `/communications/${item.followup_id}`;
  return <article className="panel" data-contact-id={item.followup_id}><details><summary>{item.patient_name} · EP-{item.episode_id} · Contacto tras alta</summary>
    <p>Médico responsable: {item.owner_name || "Sin responsable identificado"}.</p>
    <p>Contacto y aviso: {item.contacted ? "Confirmados" : "Pendientes"}. Explicación clínica: {item.explained ? "Registrada" : "Pendiente"}.</p>
    {!item.valid && <p role="status">Falta un aviso vigente. Un cambio de resultados, plan, responsable o ciclo requiere nueva autorización médica.</p>}
    {item.message && <p>Mensaje autorizado: {item.message}</p>}
    {item.next_attempt_at && <p>Próximo intento: {staffingAuditDate(item.next_attempt_at)} · hora dominicana.</p>}
    {item.history.some(e => !e.voided && e.payload.notify_doctor) && <p role="status">Dificultad de contacto registrada para atención del médico. No confirma lectura.</p>}
    {user.role === "DOCTOR" && <details><summary>Autorizar aviso de Recepción</summary>
      <ContactForm {...common} blocked={!item.can_authorize} path={`${prefix}/authorize`} label="Autorizar aviso" transform={fields => ({ mode: fields.get("mode"), message: fields.get("mode") === "MESSAGE" ? fields.get("message") : null, reason: fields.get("reason") })}>
        <label>Alcance del aviso<select name="mode" defaultValue="CONTACT_ONLY" onChange={e => setMode(e.target.value)}><option value="CONTACT_ONLY">Solo pedir contacto o regreso al centro</option><option value="MESSAGE">Transmitir un mensaje médico concreto por teléfono o presencial</option></select></label>
        {mode === "MESSAGE" && <label>Texto autorizado<textarea name="message" required minLength={3} maxLength={2000} /></label>}
        <p>Autorizar un nuevo aviso conserva el historial y requiere registrar las nuevas gestiones.</p>
      </ContactForm>
    </details>}
    {user.role === "RECEPTION" && item.notice_id !== null && <details><summary>Registrar gestión de contacto</summary>
      <ContactForm {...common} blocked={!item.can_attempt} path={`${prefix}/attempt`} label="Guardar gestión" transform={fields => {
        const dates = staffingDatePayload(fields);
        return { reason: fields.get("reason"), channel: fields.get("channel"), outcome: fields.get("outcome"), identity_verified: fields.has("identity_verified"), transmitted: fields.has("transmitted"), notify_doctor: fields.has("notify_doctor"), next_attempt_at: dates.due_at || null };
      }}>
        <label>Medio<select name="channel" required defaultValue=""><option value="">Selecciona medio</option>{Object.entries(channelNames).filter(([key]) => key !== "WHATSAPP" || item.mode === "CONTACT_ONLY" || !item.valid).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label>Resultado de la gestión<select name="outcome" required defaultValue=""><option value="">Selecciona resultado</option>{Object.entries(outcomeNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label><input type="checkbox" name="identity_verified" />Identidad verificada tras recibir respuesta</label>
        <label><input type="checkbox" name="transmitted" />Transmití el aviso autorizado</label>
        <label><input type="checkbox" name="notify_doctor" />Registrar dificultad para atención del médico responsable</label>
        <StaffDateTimeInput name="due_at" label="Próximo intento · hora dominicana" required={false} />
        <p>Programa otro intento si no hubo respuesta verificada y aviso transmitido. No copies teléfonos ni conversaciones en el motivo.</p>
      </ContactForm>
    </details>}
    {user.role === "DOCTOR" && <details><summary>Registrar explicación clínica</summary><ContactForm {...common} blocked={!item.can_explain || item.explained} path={`${prefix}/explain`} label="Confirmar explicación clínica"><p>Confirma una explicación que realizaste. No se marca automáticamente por la gestión de Recepción.</p></ContactForm></details>}
    <details><summary>Historial de este aviso</summary>
      {item.history.map(event => <div key={event.id}><Event value={event} />
        {item.valid && event.own && !event.voided && event.kind !== "RECTIFY" && ["RECEPTION", "DOCTOR"].includes(user.role) && <details><summary>Rectificar este registro</summary><ContactForm {...common} draftId={event.id} path={`${prefix}/rectify`} label="Registrar rectificación" transform={fields => ({ event_id: event.id, reason: fields.get("reason") })}><p>Conserva el hecho original y retira su vigencia; luego registra la gestión correcta.</p></ContactForm></details>}
      </div>)}
    </details>
    <History id={item.followup_id} version={item.version} />
  </details></article>;
}
function Event({ value }: { value: CommunicationEvent }) {
  return <div><strong>{eventNames[value.kind]}{value.voided ? " · Rectificado" : ""}</strong><p>{value.actor} · {staffingAuditDate(value.created_at)}</p>
    {value.payload.channel && <p>{channelNames[value.payload.channel]} · {value.payload.outcome && outcomeNames[value.payload.outcome]} · Aviso transmitido: {value.payload.transmitted ? "Sí" : "No"}.</p>}
    {value.reason && <p>Motivo: {value.reason}</p>}
    {value.rectifies_id && <p>Rectifica el registro #{value.rectifies_id}.</p>}
  </div>;
}
function History({ id, version }: { id: number; version: string }) {
  const [open, setOpen] = useState(false), [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ items: CommunicationCase[]; has_more: boolean } | null>(null), [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void api<{ items: CommunicationCase[]; has_more: boolean }>(`/communications/${id}/history?offset=${offset}`, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) { setData(value); setError(""); } }).catch(e => { if (!controller.signal.aborted) { setData(null); setError((e as Error).message); } });
    return () => controller.abort();
  }, [open, id, version, offset]);
  return <details onToggle={e => setOpen(e.currentTarget.open)}><summary>Avisos anteriores y gestiones</summary>
    {error && <p role="alert">{error}</p>}{data?.items.map(item => <section key={item.notice_id}><h2>Aviso #{item.notice_id}</h2><p>{item.authorized_at && staffingAuditDate(item.authorized_at)} · {item.valid ? "Vigente" : "Histórico"}</p>
      {item.historical_message && <p>Texto autorizado en este aviso: {item.historical_message}</p>}
      {item.authorization_reason && <p>Motivo de autorización: {item.authorization_reason}</p>}
      {item.history.map(value => <Event key={value.id} value={value} />)}</section>)}
    <button type="button" disabled={offset === 0} onClick={() => setOffset(offset - 20)}>Avisos anteriores: página previa</button><button type="button" disabled={!data?.has_more} onClick={() => setOffset(offset + 20)}>Avisos anteriores: página siguiente</button>
  </details>;
}
