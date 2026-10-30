import type { PendingOperations } from "../hooks/usePendingOperations";
import type { SampleApplied } from "./SpecimenWorkPanel";
import type { SessionUser } from "../types/clinical";
import { LaboratoryAnalysisRecord } from "./LaboratoryResultForms";
import type { LaboratorySummary } from "../types/clinical";
import { clinicalLabel } from "../presentation/clinicalLabels";
import { LaboratoryRepeatHistory } from "./SpecimenRepeatForm";

function dateLabel(value: string | null) {
  if (!value) return "Sin registrar";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo", dateStyle: "short", timeStyle: "short", hour12: true,
  }).format(date);
}

export default function StructuredLaboratoryOrder({ laboratory, user, operations, onApplied, onConflict, blocked = false }: {
  laboratory: LaboratorySummary; user?: SessionUser; operations?: PendingOperations; onApplied?: SampleApplied; onConflict?: () => void; blocked?: boolean;
}) {
  return <section aria-label="Seguimiento por muestras y analíticas">
    <LaboratoryRepeatHistory repeats={laboratory.repeats} analyses={laboratory.analyses} />
    <p>Resultados publicados: {laboratory.published_results} · Pendientes de resultado: {laboratory.pending_results}</p>
    <p>Pendientes de revisión médica: {laboratory.pending_reviews} · Analíticas canceladas: {laboratory.cancelled_analyses}</p>
    {laboratory.processing_context === "FOLLOWUP" && <p>Seguimiento de laboratorio vigente tras el alta.</p>}
    {laboratory.processing_context === "UNAVAILABLE" && <p>Consulta del historial. No consta seguimiento vigente para esta orden.</p>}
    <details>
      <summary>Ver analíticas ({laboratory.analyses.length})</summary>
      {laboratory.analyses.map(item => <LaboratoryAnalysisRecord key={item.id} analysis={item} {...{ user, operations, onApplied, onConflict }} blocked={blocked || laboratory.processing_context === "UNAVAILABLE"} />)}
    </details>
    <details>
      <summary>Ver muestras ({laboratory.specimens.length})</summary>
      {laboratory.specimens.map(item => <article key={item.id}>
        <h3>Muestra #{item.id} · {clinicalLabel("specimenKind", item.kind)}{item.kind_description ? ` · ${item.kind_description}` : ""}</h3>
        <p>Obtención: {dateLabel(item.collected_at)}</p>
        <p>Entrega: {dateLabel(item.delivered_at)}</p>
        <p>Recepción: {dateLabel(item.received_at)}</p>
        <p>Aptitud: {clinicalLabel("specimenSuitability", item.suitability)}</p>
        {item.analysis_ids.length === 0 && item.historical_analysis_ids.length > 0 && <p>Muestra anterior conservada en el historial.</p>}
      </article>)}
    </details>
  </section>;
}
