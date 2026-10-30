import { useEffect, useRef, useState } from "react";
import OperationalWriteForm from "./OperationalWriteForm";
import type { LaboratoryRepeat, LaboratorySpecimen, LaboratorySummary, SessionUser } from "../types/clinical";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { SampleApplied } from "./SpecimenWorkPanel";
import { readSpecimenDraft, saveSpecimenDraft } from "../session/specimenDrafts";
import { staffingAuditDate } from "./staffingAuditDate";

type Analysis = LaboratorySummary["analyses"][number];
function payload(fields: FormData) {
  return { reason: String(fields.get("reason") ?? ""), analysis_ids: [...fields.keys()]
    .filter(name => /^repeat_analysis_\d+$/.test(name) && fields.get(name) === "yes")
    .map(name => Number(name.slice(16))).sort((a, b) => a - b) };
}

export default function SpecimenRepeatForm(props: {
  specimen: LaboratorySpecimen; analyses: Analysis[]; user: SessionUser; operations: PendingOperations;
  blocked: boolean; onApplied: SampleApplied; onConflict: () => void;
}) {
  if (props.user.role !== "LAB") return null;
  return <RepeatEditor key={`${props.user.username}:${props.specimen.id}`} {...props} />;
}
function RepeatEditor({ specimen, analyses, user, operations, blocked, onApplied, onConflict }: Parameters<typeof SpecimenRepeatForm>[0]) {
  const path = `/lab/specimens/${specimen.id}/repeat`;
  const [saved] = useState(() => readSpecimenDraft(user, path));
  const [warning, setWarning] = useState(saved.warning);
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const choices = analyses.filter(item => specimen.analysis_ids.includes(item.id) && !item.cancelled_at);
  const unavailable = blocked || !specimen.version || specimen.suitability !== "REJECTED" || choices.length === 0;
  function validate() {
    const boxes = [...(root.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? [])];
    const any = boxes.some(box => box.checked);
    boxes.forEach((box, index) => box.setCustomValidity(index === 0 && !any ? "Selecciona al menos una analítica para la nueva muestra." : ""));
  }
  useEffect(validate, [choices]);
  return <details><summary>Solicitar nueva muestra</summary>
    <p>Selecciona las analíticas que requieren otra muestra del mismo tipo. La muestra anterior permanece en el historial.</p>
    {specimen.suitability !== "REJECTED" && <p>La muestra anterior debe estar registrada como no apta.</p>}
    {choices.length === 0 && <p>No hay analíticas vigentes que todavía requieran esta muestra.</p>}
    {blocked && <p>No hay un contexto vigente que permita solicitar esta muestra.</p>}
    {!specimen.version && <p>Actualiza los datos para verificar la versión de la muestra.</p>}
    {warning && <p role="alert">{warning}</p>}
    <div ref={root} className="laboratory-order" onChange={validate}>
      <OperationalWriteForm path={path} version={specimen.version} label="Confirmar solicitud de nueva muestra" conflictNoun="muestra"
        operations={operations} blocked={unavailable} initialDraft={saved.draft} transform={payload}
        onDraft={(version, fields, dirty) => setWarning(saveSpecimenDraft(user, path, version, fields, dirty))}
        onDirty={() => {}} onConflict={() => { if (mounted.current) onConflict(); }}
        onApplied={(...args) => { if (mounted.current) onApplied(...args); }}>
        {choices.map(item => <label className="sample-analysis-link" key={item.id}>
          <input type="checkbox" name={`repeat_analysis_${item.id}`} value="yes" />{item.title} · Analítica #{item.id}
        </label>)}
      </OperationalWriteForm>
    </div>
  </details>;
}

export function LaboratoryRepeatHistory({ repeats, analyses }: { repeats?: LaboratoryRepeat[]; analyses: Analysis[] }) {
  if (!repeats?.length) return null;
  return <details><summary>Historial de nuevas muestras ({repeats.length})</summary>
    {repeats.map(item => <article key={item.id}>
      <h4>{analyses.find(analysis => analysis.id === item.analysis_id)?.title ?? `Analítica #${item.analysis_id}`}</h4>
      <p>Muestra anterior #{item.previous_specimen_id} · Nueva muestra #{item.new_specimen_id}</p>
      <p>Motivo: {item.reason}</p>
      <p>{item.requested_by_username} · {staffingAuditDate(item.requested_at)}</p>
    </article>)}
  </details>;
}
