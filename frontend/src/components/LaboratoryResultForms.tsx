import { useEffect, useRef, useState } from "react";
import OperationalWriteForm from "./OperationalWriteForm";
import { readSpecimenDraft, saveSpecimenDraft } from "../session/specimenDrafts";
import type { LaboratorySummary, LaboratoryResultVersion, SessionUser } from "../types/clinical";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { SampleApplied } from "./SpecimenWorkPanel";
import { staffingAuditDate } from "./staffingAuditDate";

type Analysis = LaboratorySummary["analyses"][number];
type Action = "publish" | "correct" | "annul" | "review" | "cancel" | "reinstate";
const labels: Record<Action, string> = { publish: "Publicar resultado de esta analítica", correct: "Registrar corrección del resultado", annul: "Anular vigencia del resultado", review: "Confirmar revisión médica", cancel: "Cancelar analítica pendiente", reinstate: "Reactivar analítica cancelada" };
const noop = () => {};
export function LaboratoryAnalysisRecord(props: Parameters<typeof LaboratoryResultForms>[0]) {
  const item = props.analysis;
  return <article>
    <h3>{item.title}</h3>
    {item.cancelled_at && <p>Analítica cancelada · Motivo: {item.cancellation_reason}</p>}
    {item.has_result ? <><p>Resultado vigente: {item.current_result}</p><p>Revisión médica: {item.needs_medical_review ? "Pendiente" : "Realizada"}</p></> :
      <p>{item.result_annulled ? "Resultado anulado" : "Sin resultado publicado"}</p>}
    {!item.cancelled_at && !item.satisfies_current_samples && <p>Trabajo pendiente para esta analítica.</p>}
    <LaboratoryResultForms {...props} />
  </article>;
}
function payload(fields: FormData) {
  const body: Record<string, unknown> = { reason: String(fields.get("reason") ?? "") };
  if (fields.has("result")) body.result = String(fields.get("result"));
  if (fields.has("specimen_ids")) body.specimen_ids = String(fields.get("specimen_ids")).split(",").filter(Boolean).map(Number);
  return body;
}

function ResultAction({ path, analysis, action, blocked, user, operations, onApplied, onConflict }: {
  path: string; analysis: Analysis; action: Action; blocked: boolean; user: SessionUser;
  operations: PendingOperations; onApplied: SampleApplied; onConflict: () => void;
}) {
  const [saved] = useState(() => readSpecimenDraft(user, path));
  const [warning, setWarning] = useState(saved.warning);
  const sources = analysis.required_specimens ?? [];
  const ids = sources.map(source => source.id).join(",");
  return <details><summary>{labels[action]}</summary>
    {blocked && <p>Esta acción no está disponible con el estado actual. Conserva los campos para revisión.</p>}
    {warning && <p role="alert">{warning}</p>}
    <OperationalWriteForm path={path} version={analysis.version} label={labels[action]} conflictNoun="resultado"
      blocked={blocked || !analysis.version} operations={operations} transform={payload} initialDraft={saved.draft}
      onDraft={(version, fields, dirty) => setWarning(saveSpecimenDraft(user, path, version, fields, dirty))}
      onApplied={onApplied} onConflict={onConflict} onDirty={noop}>
      {(action === "publish" || action === "correct") && <label>{action === "publish" ? "Resultado de la analítica" : "Resultado corregido"}<textarea name="result" required minLength={3} maxLength={2000} rows={4} /></label>}
      {action === "publish" && <label>Muestras fuente del resultado<select name="specimen_ids" required defaultValue="">
        <option value="">Comprueba y confirma las muestras</option>
        {ids && <option key={ids} value={ids}>Confirmo muestras {sources.map(source => `#${source.id}`).join(", ")}, recibidas y aptas</option>}
      </select></label>}
      {action === "annul" && <p>El informe quedará sin vigencia. Su texto y revisiones anteriores se conservan.</p>}
      {action === "review" && <p>Confirmas la revisión de esta versión exacta; no cambia su texto ni completa otras analíticas.</p>}
      {action === "cancel" && <p>Se cancela el trabajo pendiente de esta analítica, conservando sus muestras, resultados e historial.</p>}
      {action === "reinstate" && <p>La analítica vuelve a requerir seguimiento. Su cancelación anterior se conserva en el historial.</p>}
    </OperationalWriteForm>
  </details>;
}

export default function LaboratoryResultForms({ analysis, user, operations, blocked = false, onApplied, onConflict }: {
  analysis: Analysis; user?: SessionUser; operations?: PendingOperations; blocked?: boolean;
  onApplied?: SampleApplied; onConflict?: () => void;
}) {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const versions = analysis.versions ?? [];
  const latest = versions.at(-1);
  const canWrite = Boolean(user && operations && onApplied && analysis.version);
  const lab = canWrite && user?.role === "LAB";
  const owns = canWrite && user?.role === "DOCTOR" && user.username === analysis.reviewer_username;
  const ready = Boolean(analysis.required_specimens?.length && analysis.required_specimens.every(source => source.received_at && source.suitability === "ACCEPTED"));
  function action(kind: Action, path: string, unavailable: boolean) {
    if (!user || !operations || !onApplied) return null;
    return <ResultAction key={path} {...{ path, analysis, action: kind, user, operations }} blocked={blocked || unavailable}
      onApplied={(...args) => { if (mounted.current) onApplied(...args); }}
      onConflict={() => { if (mounted.current) onConflict?.(); }} />;
  }
  return <>
    {owns && <>
      {!analysis.cancelled_at && analysis.needs_medical_review && <p>Revisa el resultado vigente antes de cancelar el trabajo pendiente.</p>}
      {!analysis.cancelled_at && analysis.satisfies_current_samples && <p>Analítica completada. Laboratorio puede corregir o anular la vigencia del resultado.</p>}
      {analysis.cancelled_at && analysis.reinstatement_requires_plan && <p>Registra un plan de seguimiento tras el alta antes de reactivar el trabajo pendiente.</p>}
      {action("cancel", `/lab/analyses/${analysis.id}/cancel`, Boolean(analysis.cancelled_at) || analysis.needs_medical_review || analysis.satisfies_current_samples)}
      {action("reinstate", `/lab/analyses/${analysis.id}/reinstate`, !analysis.cancelled_at || Boolean(analysis.reinstatement_requires_plan))}
    </>}
    {lab && <>
      {!ready && <p>Para publicar hacen falta todas las muestras requeridas, recibidas y aptas.</p>}
      {action("publish", `/lab/analyses/${analysis.id}/results`, Boolean(analysis.cancelled_at) || analysis.satisfies_current_samples || !ready)}
    </>}
    {versions.length > 0 && <section aria-label={`Versiones de ${analysis.title}`}>
      {versions.map(version => {
        const current = version.id === latest?.id;
        const published = version.action !== "ANNUL";
        return <details key={version.id} open={current}>
          <summary>Versión {version.sequence} · {current ? (published ? "Vigente" : "Anulada") : "Anterior"} · {staffingAuditDate(version.published_at)}</summary>
          <VersionText version={version} showText={!current} />
          {!current && <p>Versión anterior conservada. Las acciones se registran sobre el informe vigente.</p>}
          {lab && <>
            {action("correct", `/lab/results/${version.id}/corrections`, !current || !published)}
            {action("annul", `/lab/results/${version.id}/annul`, !current || !published)}
          </>}
          {owns && action("review", `/lab/results/${version.id}/review`, !current || !published || Boolean(version.reviewed_at))}
        </details>;
      })}
    </section>}
    {user?.role === "DOCTOR" && analysis.needs_medical_review && !owns && <p>La revisión corresponde al médico responsable confirmado; un sustituto debe aceptar primero el relevo.</p>}
  </>;
}

function VersionText({ version, showText }: { version: LaboratoryResultVersion; showText: boolean }) {
  return <>{showText && <p>{version.action === "ANNUL" ? "Resultado sin vigencia" : `Texto registrado: ${version.result}`}</p>}
    {version.reason && <p>Motivo: {version.reason}</p>}
    <p>{version.reviewed_at ? `Revisada: ${staffingAuditDate(version.reviewed_at)}` : version.action === "ANNUL" ? "Esta versión anulada no admite revisión." : "Sin revisión médica de esta versión."}</p></>;
}
