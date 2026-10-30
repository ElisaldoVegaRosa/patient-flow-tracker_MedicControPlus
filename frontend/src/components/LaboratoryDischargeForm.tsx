import { useEffect, useRef, useState } from "react";
import OperationalWriteForm from "./OperationalWriteForm";
import StaffDateTimeInput from "./StaffDateTimeInput";
import { staffingDatePayload } from "./staffingAuditDate";
import { readSpecimenDraft, saveSpecimenDraft } from "../session/specimenDrafts";
import type { Episode, SessionUser } from "../types/clinical";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { SampleApplied } from "./SpecimenWorkPanel";

export default function LaboratoryDischargeForm(props: {
  episode: Episode; user: SessionUser; operations: PendingOperations; onApplied: SampleApplied;
  onConflict: (current: () => boolean) => void; initialNote?: string; onNoteChange?: (note: string) => void;
}) {
  if (props.user.role !== "DOCTOR" || props.episode.status !== "ACTIVE" || !props.episode.laboratory?.orders.length) return null;
  return <DischargeEditor key={props.episode.id} {...props} />;
}
function DischargeEditor({ episode, user, operations, onApplied, onConflict, initialNote = "", onNoteChange }: Parameters<typeof LaboratoryDischargeForm>[0]) {
  const path = `/episodes/${episode.id}/discharge`;
  const [saved] = useState(() => readSpecimenDraft(user, path));
  const [warning, setWarning] = useState(saved.warning);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const orders = episode.laboratory!.orders;
  const analyses = orders.flatMap(order => order.results ?? []);
  const legacyIds = episode.laboratory!.legacy_order_ids ?? [];
  const legacy = episode.tasks.filter(task => legacyIds.includes(task.id) && task.service === "LAB");
  const unresolved = legacy.filter(task => !["COMPLETED", "ANNULLED"].includes(task.status));
  const toReview = legacy.filter(task => task.status === "COMPLETED");
  const missingText = toReview.some(task => !task.result?.trim());
  const pending = analyses.filter(item => !item.cancelled_at && !item.satisfies_current_samples).length;
  const reviews = analyses.filter(item => item.needs_medical_review).length;
  const owner = analyses[0]?.medical_owner;
  const invalidOwner = !owner || owner.role !== "DOCTOR" || owner.active !== 1;
  const mustOwn = pending > 0 || toReview.length > 0;
  const reassessments = episode.reevaluations?.some(item => item.status === "PENDING");
  const blocked = !episode.clinical_version || orders.some(order => !order.results?.length) || invalidOwner ||
    (mustOwn && owner?.username !== user.username) || unresolved.length > 0 || missingText || reviews > 0 || reassessments || legacy.length !== legacyIds.length || toReview.some(task => !task.version);
  function payload(fields: FormData) {
    const data = staffingDatePayload(fields);
    return { note: data.note, reason: data.reason,
      legacy_reviews: [...fields.keys()].filter(name => /^legacy_review_\d+$/.test(name))
        .map(name => ({ task_id: Number(name.slice(14)), version: String(fields.get(name)) })).sort((a, b) => a.task_id - b.task_id),
      ...(pending ? { followup: { reason: data.followup_reason, review_due_at: data.due_at, communication_plan: data.communication_plan } } : {}),
    };
  }
  return <section className="panel laboratory-order"><h2>Alta con seguimiento de laboratorio</h2>
    <p>Resultados nuevos pendientes: {pending} · Resultados nuevos por revisar: {reviews} · Órdenes anteriores pendientes: {unresolved.length}.</p>
    {unresolved.length > 0 && <p role="status">Resuelve las órdenes anteriores pendientes en laboratorio antes del alta. Un plan no las sustituye.</p>}
    {missingText && <p role="status">Hay órdenes anteriores completadas sin texto de resultado. Revisa sus datos en laboratorio.</p>}
    {reviews > 0 && <p role="status">Revisa los resultados publicados de las analíticas antes del alta.</p>}
    {reassessments && <p role="status">Completa o cancela con motivo las reevaluaciones pendientes antes del alta.</p>}
    {(invalidOwner || (mustOwn && owner?.username !== user.username)) && <p role="status">El médico responsable confirmado debe revisar los resultados anteriores y asumir los pendientes.</p>}
    {!episode.clinical_version && <p role="alert">Actualiza el episodio para verificar su versión antes del alta.</p>}
    {warning && <p role="alert">{warning}</p>}
    <div onReset={() => onNoteChange?.("")} onChange={event => {
      if (event.target instanceof HTMLTextAreaElement && event.target.name === "note") onNoteChange?.(event.target.value);
    }}>
      <OperationalWriteForm path={path} version={episode.clinical_version} label="Cerrar episodio · Alta médica" reasonLabel="Motivo del alta con laboratorio"
        conflictNoun="episodio" operations={operations} blocked={Boolean(blocked)} initialDraft={saved.draft} transform={payload}
        onDraft={(version, fields, dirty) => setWarning(saveSpecimenDraft(user, path, version, fields, dirty))}
        onDirty={() => {}} onConflict={() => { if (mounted.current) onConflict(() => mounted.current); }}
        onApplied={(...args) => { if (mounted.current) onApplied(...args); }}>
        <label>Nota de alta<textarea name="note" defaultValue={initialNote} required minLength={3} maxLength={2000} rows={4} /></label>
        {toReview.map(task => <fieldset key={task.id}><legend>Revisión de orden anterior #{task.id} · {task.title}</legend>
          <p>Resultado vigente: {task.result || "Sin texto registrado"}</p>
          <label className="sample-analysis-link" key={`${task.id}:${task.version}`}><input type="checkbox" name={`legacy_review_${task.id}`} value={task.version ?? ""} required disabled={!task.version} />Confirmo la revisión de este resultado anterior · Orden #{task.id}</label>
        </fieldset>)}
        {pending > 0 && <fieldset><legend>Plan para los resultados nuevos pendientes</legend>
          <label>Motivo del seguimiento<textarea name="followup_reason" required minLength={3} maxLength={2000} /></label>
          <StaffDateTimeInput name="due_at" label="Fecha de revisión · hora dominicana" />
          <label>Cómo se informará al paciente<textarea name="communication_plan" required minLength={3} maxLength={2000} /></label>
        </fieldset>}
      </OperationalWriteForm>
    </div>
  </section>;
}
