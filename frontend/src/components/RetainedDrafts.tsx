import type { DraftKind, FormDraft } from "../session/formDrafts";
import { clinicalLabel } from "../presentation/clinicalLabels";

const kinds: Record<DraftKind, string> = { triage: "Triaje", vitals: "Signos vitales", evaluation: "Evaluación", order: "Orden", lab: "Laboratorio", discharge: "Nota de alta", arrival: "Ingreso" };
const fields: Record<string, string> = { priority: "Prioridad", location: "Ubicación", assigned_to: "Personal responsable", diagnosis: "Diagnóstico", clinical_note: "Nota de evaluación", disposition: "Decisión médica", title: "Descripción de la orden", service: "Servicio", result: "Resultado", note: "Nota de alta", temperature: "Temperatura", heart_rate: "Frecuencia cardíaca", systolic: "Presión sistólica", diastolic: "Presión diastólica", spo2: "Saturación", respiratory_rate: "Frecuencia respiratoria" };

export default function RetainedDrafts({ drafts }: { drafts: FormDraft[] }) {
  if (!drafts.length) return null;
  return <section className="panel" aria-label="Texto local conservado">
    <h2>Texto local conservado</h2>
    <p>El episodio se cerró o la orden dejó de estar pendiente en otra sesión. Estos campos no se enviaron; puedes copiar su contenido. Se conservan solo mientras sigas en esta pantalla.</p>
    {drafts.map(draft => <article key={`${draft.kind}:${draft.taskId ?? draft.episodeId}`}>
      <h3>EP-{draft.episodeId}{draft.taskId ? ` · Orden #${draft.taskId}` : ""} · {kinds[draft.kind]}</h3>
      <dl>{Object.entries(draft.fields).filter(([, value]) => value.trim()).map(([name, value]) => <div key={name}>
        <dt>{fields[name] ?? name}</dt><dd style={{ whiteSpace: "pre-wrap" }}>{name === "service" || name === "disposition" ? clinicalLabel(name, value) : value}</dd>
      </div>)}</dl>
    </article>)}
  </section>;
}
