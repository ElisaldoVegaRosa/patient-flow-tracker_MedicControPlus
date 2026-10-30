import { useEffect, useRef, useState } from "react";
import { api, isSessionInterruption } from "../api/client";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { LaboratorySpecimen, SampleProfessional, SessionUser } from "../types/clinical";
import { readSpecimenDraft, saveSpecimenDraft } from "../session/specimenDrafts";
import { clinicalLabel } from "../presentation/clinicalLabels";
import OperationalWriteForm from "./OperationalWriteForm";
import SpecimenRepeatForm from "./SpecimenRepeatForm";
import type { LaboratorySummary } from "../types/clinical";
import StaffDateTimeInput from "./StaffDateTimeInput";
import { staffingAuditDate, staffingDatePayload } from "./staffingAuditDate";

export type SampleApplied = (path: string, result: unknown, body?: BodyInit | null) => void;
const noop = () => {};
const actions = { collection: "Registrar obtención", delivery: "Registrar entrega", receipt: "Confirmar recepción", suitability: "Registrar aptitud" };
type Action = keyof typeof actions;

function payload(fields: FormData): Record<string, unknown> {
  const raw = staffingDatePayload(fields);
  const result: Record<string, unknown> = { reason: raw.reason };
  if (raw.time_mode === "EXACT") result.occurred_at = raw.occurred_at;
  if (raw.location !== undefined) result.location = raw.location;
  if (raw.suitability !== undefined) result.suitability = raw.suitability;
  const kind = raw.performed_by;
  const who = raw.location !== undefined ? "collector" : "deliverer";
  if (kind !== undefined) {
    result[`${who}_kind`] = kind === "SELF" || kind === "OTHER" ? "USER" : kind;
    if (kind === "OTHER") result[`${who}_user_id`] = Number(raw.professional_id);
  }
  return result;
}

function SampleAction({ action, specimen, user, professionals, operations, blocked, onApplied, onConflict }: {
  action: Action; specimen: LaboratorySpecimen; user: SessionUser; professionals: SampleProfessional[];
  operations: PendingOperations; blocked: boolean; onApplied: SampleApplied; onConflict: () => void;
}) {
  const path = `/lab/specimens/${specimen.id}/${action}`;
  const [saved] = useState(() => readSpecimenDraft(user, path));
  const [warning, setWarning] = useState(saved.warning);
  const [time, setTime] = useState(saved.draft?.fields.time_mode ?? "NOW");
  const [who, setWho] = useState(saved.draft?.fields.performed_by ?? "SELF");
  const registered = action === "collection" ? specimen.collected_at : action === "delivery" ? specimen.delivered_at : action === "receipt" ? specimen.received_at : specimen.suitability !== "UNKNOWN";
  const unavailable = blocked || Boolean(registered) || (action === "suitability" && !specimen.received_at) || !specimen.version;
  return <details><summary>{actions[action]}{registered ? " · Ya registrado" : ""}</summary>
    {registered && <p>Este hecho ya está registrado. Los campos anteriores se conservan solo para revisión.</p>}
    {action === "suitability" && !specimen.received_at && <p>Confirma la recepción antes de valorar la aptitud.</p>}
    {blocked && <p>No hay un contexto vigente que permita registrar esta muestra.</p>}
    {!specimen.version && <p>No se pudo verificar el estado actual de la muestra. Actualiza los datos antes de registrar.</p>}
    {warning && <p role="alert">{warning}</p>}
    <div onReset={() => { setTime("NOW"); setWho("SELF"); }}>
      <OperationalWriteForm path={path} version={specimen.version} label={actions[action]} conflictNoun="muestra" operations={operations}
        initialDraft={saved.draft} onDraft={(version, fields, dirty) => setWarning(saveSpecimenDraft(user, path, version, fields, dirty))}
        blocked={unavailable} onApplied={onApplied} onConflict={onConflict} onDirty={noop} transform={payload}>
        {(action === "collection" || action === "delivery") && <>
          <label>{action === "collection" ? "Quién obtuvo la muestra" : "Quién entregó la muestra"}<select name="performed_by" defaultValue="SELF" onChange={event => setWho(event.target.value)}>
            <option value="SELF">Yo, profesional que registra</option>
            {(action === "delivery" || ["STOOL", "URINE"].includes(specimen.kind)) && <option value="PATIENT">El paciente</option>}<option value="OTHER">Otro profesional</option>
            {action === "delivery" && <option value="THIRD_PARTY">Otra persona sin cuenta profesional</option>}
          </select></label>
          <label>Profesional que realizó el hecho<select name="professional_id" disabled={who !== "OTHER"} required={who === "OTHER"}>
            <option value="">Selecciona un profesional</option>{professionals.map(person => <option key={person.id} value={person.id}>{person.display_name || person.username} ({person.username})</option>)}
          </select></label>
        </>}
        {action === "collection" && <label>Lugar de obtención<input name="location" required maxLength={200} /></label>}
        {action === "suitability" ? <label>Aptitud de la muestra<select name="suitability" required defaultValue=""><option value="">Selecciona aptitud</option><option value="ACCEPTED">Apta</option><option value="REJECTED">No apta</option></select></label> : <>
          <label>Momento del hecho<select name="time_mode" defaultValue="NOW" onChange={event => setTime(event.target.value)}><option value="NOW">Ocurrió ahora, al registrar</option><option value="EXACT">Indicar fecha y hora del hecho</option></select></label>
          {time === "EXACT" && <StaffDateTimeInput name="occurred_at" label="Fecha y hora del hecho · hora dominicana" />}
        </>}
      </OperationalWriteForm>
    </div>
  </details>;
}

export default function SpecimenWorkPanel({ specimens, analyses, user, operations, blocked = false, onApplied, onConflict }: {
  analyses?: LaboratorySummary["analyses"];
  specimens: LaboratorySpecimen[]; user: SessionUser; operations: PendingOperations; blocked?: boolean;
  onApplied: SampleApplied; onConflict: () => void;
}) {
  const [professionals, setProfessionals] = useState<SampleProfessional[] | null>(null);
  const [error, setError] = useState("");
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    if (!["LAB", "NURSE"].includes(user.role)) return;
    void api<{ professionals: SampleProfessional[] }>("/lab/sample-professionals").then(data => {
      if (active) setProfessionals(data.professionals);
    }).catch(exception => { if (active && !isSessionInterruption(exception)) { setProfessionals(previous => previous ?? []); setError("No se pudo consultar el personal. Reintenta la consulta antes de registrar a otro profesional."); } });
    return () => { active = false; };
  }, [user.username, user.role, lookupAttempt]);
  if (!["LAB", "NURSE"].includes(user.role)) return null;
  return <section aria-label="Registro de muestras">
    <h3>Registro de muestras</h3>
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => { setError(""); setLookupAttempt(value => value + 1); }}>Reintentar consulta de profesionales</button></div>}
    {professionals === null ? <p>Cargando profesionales…</p> : specimens.map(specimen => <details key={specimen.id}>
      <summary>Muestra #{specimen.id} · {clinicalLabel("specimenKind", specimen.kind)}</summary>
      <p>Obtención: {specimen.collected_at ? staffingAuditDate(specimen.collected_at) : "Sin registrar"}</p>
      <p>Entrega: {specimen.delivered_at ? staffingAuditDate(specimen.delivered_at) : "Sin registrar"}</p>
      <p>Recepción: {specimen.received_at ? staffingAuditDate(specimen.received_at) : "Sin registrar"}</p>
      <p>Aptitud: {clinicalLabel("specimenSuitability", specimen.suitability)}</p>
      {(["collection", "delivery", ...(user.role === "LAB" ? ["receipt", "suitability"] : [])] as Action[]).map(action =>
        <SampleAction key={action} {...{ action, specimen, user, professionals, operations }}
          onApplied={(...args) => { if (mounted.current) onApplied(...args); }}
          onConflict={() => { if (mounted.current) onConflict(); }} blocked={blocked} />)}
      {analyses && <SpecimenRepeatForm {...{ specimen, analyses, user, operations, blocked }}
        onApplied={(...args) => { if (mounted.current) onApplied(...args); }}
        onConflict={() => { if (mounted.current) onConflict(); }} />}
    </details>)}
  </section>;
}
