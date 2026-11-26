import { useEffect, useRef, useState } from "react";
import { api, getSessionRevision } from "../api/client";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { AllergyValues, Episode, PatientAllergyData, SessionUser } from "../types/clinical";
import { OPERATION_CONFIRMED_EVENT, OPERATION_CONFLICT_EVENT, notifyOperationalConfirmation } from "../session/operationalWrites";
import { readSpecimenDraft, saveSpecimenDraft } from "../session/specimenDrafts";
import OperationalWriteForm from "./OperationalWriteForm";
import { staffingAuditDate } from "./staffingAuditDate";

const labels = { UNKNOWN: "Sin información de alergias", NONE_KNOWN: "Sin alergias conocidas", REPORTED: "Alergias registradas" };
const payload = (fields: FormData) => ({ status: fields.get("allergy_status"), description: fields.get("allergy_description"),
  source: fields.get("allergy_source"), reason: fields.get("reason") });
type Props = { episode: Episode; user: SessionUser; operations: PendingOperations; onUpdated: (episode: Episode) => void };

export default function PatientAllergies(props: Props) {
  if (!["DOCTOR", "NURSE"].includes(props.user.role)) return null;
  return <Panel key={`${props.user.username}:${props.user.role}:${props.episode.id}:${props.episode.patient_id}`} {...props} />;
}

function Values({ value }: { value: AllergyValues }) {
  return <><p>{labels[value.status]}</p>{value.description && <p className="allergy-text">{value.description}</p>}
    {value.source && <p className="allergy-text">Fuente: {value.source}</p>}</>;
}

function Panel({ episode, user, operations, onUpdated }: Props) {
  const path = `/episodes/${episode.id}/allergies`;
  const [requested, setRequested] = useState(false);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<PatientAllergyData | null>(null);
  const context = requested ? `${getSessionRevision()}:${user.username}:${user.role}:${path}:${offset}` : null;
  const { refresh, error, updated } = useLiveRefresh({ context, paused: operations.hasPending,
    load: async signal => {
      const result = await api<PatientAllergyData>(`${path}?limit=10&offset=${offset}`, { signal });
      if (result.episode_id !== episode.id || (episode.patient_id !== undefined && result.patient_id !== episode.patient_id) ||
          result.offset !== offset || result.limit !== 10) throw new Error("El registro recibido no corresponde a esta consulta.");
      return () => setData(result);
    },
  });
  useEffect(() => { if (requested) void refresh(); }, [requested, context, refresh]);
  useEffect(() => {
    const confirmed = (event: Event) => {
      const detail = (event as CustomEvent<{path: string}>).detail;
      if (detail.path !== path) return;
      if (offset) setOffset(0); else void refresh();
    };
    const conflict = (event: Event) => { if ((event as CustomEvent<string>).detail === path) void refresh(); };
    window.addEventListener(OPERATION_CONFIRMED_EVENT, confirmed);
    window.addEventListener(OPERATION_CONFLICT_EVENT, conflict);
    return () => { window.removeEventListener(OPERATION_CONFIRMED_EVENT, confirmed); window.removeEventListener(OPERATION_CONFLICT_EVENT, conflict); };
  }, [path, offset, refresh]);
  return <section className="panel" aria-label="Alergias del paciente">
    <h2>Alergias del paciente</h2>
    {!requested && <p>El registro de esta ficha aún no se ha consultado. Esto no indica ausencia de alergias.</p>}
    <button type="button" onClick={() => { if (!requested) setRequested(true); else void refresh(); }}>
      {requested ? "Actualizar alergias" : "Consultar alergias"}</button>
    {requested && !data && !error && <p role="status">Consultando alergias…</p>}
    {error && <p role="alert">No se pudo actualizar el registro de alergias. {data ? "Se muestra la última consulta; actualiza antes de guardar." : "Vuelve a consultar."} {error}</p>}
    {data && <>
      <p>Registro vigente de la ficha del paciente. {episode.status !== "ACTIVE" && "Puede incluir revisiones posteriores a esta visita histórica."}</p>
      <Values value={data.profile} />
      {data.profile.reviewed_at ? <p>Revisado por {data.profile.reviewed_by} · {staffingAuditDate(data.profile.reviewed_at)} · EP-{data.profile.episode_id}.</p> :
        <p>No hay una revisión registrada. No se ha marcado al paciente como libre de alergias.</p>}
      {updated && <p>Última consulta: {staffingAuditDate(new Date(updated).toISOString())} · hora dominicana.</p>}
      <p>La revisión de este registro no significa confirmación de una alergia mediante pruebas.</p>
      {user.role === "DOCTOR" ? <Editor episode={episode} user={user} operations={operations} onUpdated={onUpdated}
        data={data} blocked={Boolean(error) || !updated} refresh={refresh} /> : <p>Enfermería: consulta del registro. La edición corresponde al médico responsable.</p>}
      <details><summary>Historial de alergias ({data.total})</summary>
        {data.history.length === 0 && <p>{data.total ? "No hay cambios en esta página; vuelve a la anterior." : "Sin cambios registrados."}</p>}
        {data.history.map(change => <article key={change.id}>
          <h3>Revisión del registro · EP-{change.episode_id}</h3>
          <p>{change.username} · {staffingAuditDate(change.created_at)}</p>
          <p>Anterior:</p><Values value={change.before} /><p>Nuevo:</p><Values value={change.after} />
          <p className="allergy-text">Motivo: {change.reason}</p>
        </article>)}
        <nav className="patient-history-pagination" aria-label="Páginas del historial de alergias">
          <button type="button" disabled={data.offset === 0 || data.offset !== offset} onClick={() => setOffset(Math.max(0, offset - 10))}>Página anterior de cambios</button>
          <button type="button" disabled={data.offset + 10 >= data.total || data.offset !== offset} onClick={() => setOffset(offset + 10)}>Más cambios de alergias</button>
        </nav>
      </details>
    </>}
  </section>;
}

function Editor({ episode, user, operations, onUpdated, data, blocked, refresh }: Props & { data: PatientAllergyData; blocked: boolean; refresh: () => Promise<void> }) {
  const path = `/episodes/${episode.id}/allergies`;
  const [saved] = useState(() => readSpecimenDraft(user, path));
  const [warning, setWarning] = useState(saved.warning.replace("de laboratorio", "de alergias"));
  const [confirmed, setConfirmed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const unavailable = blocked || !data.can_edit || episode.status !== "ACTIVE";
  return <details><summary>Registrar o corregir alergias</summary>
    {!data.can_edit && <p>{episode.status === "ACTIVE" ? `Solo el médico responsable confirmado puede editar. Responsable: ${data.responsible || "Sin responsable confirmado"}. Acepta el relevo antes de sustituirlo.` : "Esta visita está cerrada; el registro se consulta sin editar."}</p>}
    {warning && <p role="alert">{warning}</p>}{confirmed && <p role="status">Registro de alergias guardado.</p>}
    <OperationalWriteForm path={path} method="PATCH" version={data.version} transform={payload} selectDefaults={{ allergy_status: data.profile.status }} blocked={unavailable}
      conflictNoun="registro de alergias" label="Guardar registro de alergias" reasonLabel="Motivo del registro o corrección"
      operations={operations} initialDraft={saved.draft} onDirty={() => {}}
      onDraft={(baseline, fields, dirty) => { setWarning(saveSpecimenDraft(user,path,baseline,fields,dirty)); if (dirty) setConfirmed(false); }}
      onConflict={() => { void refresh(); }} onApplied={(confirmedPath,result,body) => {
        if (!mounted.current) return;
        notifyOperationalConfirmation(confirmedPath,body); setConfirmed(true); onUpdated(result as Episode);
      }}>
      <label>Estado de alergias<select name="allergy_status" defaultValue={data.profile.status}>
        <option value="UNKNOWN">Sin información de alergias</option><option value="NONE_KNOWN">Sin alergias conocidas</option><option value="REPORTED">Alergias registradas</option>
      </select></label>
      <label>Alergias y reacciones informadas<textarea name="allergy_description" rows={3} minLength={3} maxLength={2000} defaultValue={data.profile.description} /></label>
      <p>Describe las alergias si eliges “Alergias registradas”. Para los otros estados, deja la descripción vacía; el texto anterior permanece en el historial.</p>
      <label>Fuente de la información<textarea name="allergy_source" required minLength={3} maxLength={2000} defaultValue={data.profile.source} placeholder="Paciente, familiar o documento consultado" /></label>
    </OperationalWriteForm>
  </details>;
}
