import { useEffect, useRef, useState } from "react";
import { api, isSessionInterruption } from "../api/client";
import type { Episode, ReevaluationChange, User } from "../types/clinical";
import type { PendingOperations } from "../hooks/usePendingOperations";
import OperationalWriteForm from "./OperationalWriteForm";
import ReevaluationSchedule from "./ReevaluationSchedule";
import ReevaluationDue, { ReevaluationSummary } from "./ReevaluationDue";
import { staffingAuditDate } from "./staffingAuditDate";
import { notifyOperationalConfirmation } from "../session/operationalWrites";
import { clinicalLabel } from "../presentation/clinicalLabels";

const actionLabels: Record<string, string> = { CREATE: "Reevaluación programada", COMPLETE: "Acción realizada", CANCEL: "Acción cancelada", RESCHEDULE: "Acción reprogramada" };
const statusLabel = (status: string) => status === "COMPLETED" ? "Realizada" : status === "CANCELLED" ? "Cancelada" : "Pendiente";
function payload(fields: FormData) {
  return Object.fromEntries(["title", "due_at", "medical_instruction", "nursing_instruction", "reason", "completion_note"]
    .filter(key => Boolean(String(fields.get(key) ?? "").trim())).map(key => [key, fields.get(key)]));
}
type Summary = { title: string; due_at: string; status: string; result?: string | null };
function snapshot(text: string): Summary | null {
  const value = JSON.parse(text);
  if (value === null) return null;
  if (typeof value.title !== "string" || typeof value.due_at !== "string" || typeof value.status !== "string") throw new Error("Invalid summary");
  return value as Summary;
}
function snapshots(change: ReevaluationChange): [Summary | null, Summary | null] {
  try { return [snapshot(change.old_value), snapshot(change.new_value)]; }
  catch { return [null, null]; }
}
function Changes({ change }: { change: ReevaluationChange }) {
  const [before, after] = snapshots(change);
  if (!after) return <li>Registro conservado. No se pudo mostrar su resumen.</li>;
  return <li><h4>{actionLabels[change.action] ?? "Cambio de reevaluación"} · {after.title}</h4>
    <p>{staffingAuditDate(change.created_at)} · {change.actor}</p><p>Motivo: {change.reason}</p>
    {before && before.due_at !== after.due_at && <p>Fecha anterior: {staffingAuditDate(before.due_at)} → Nueva fecha: {staffingAuditDate(after.due_at)}</p>}
    {before && before.status !== after.status && <p>Estado anterior: {statusLabel(before.status)} → Nuevo estado: {statusLabel(after.status)}</p>}
    {after.result && <p>Lo realizado: {after.result}</p>}
  </li>;
}
export default function ReevaluationsPanel({ episode, user, operations, updateEpisode }: {
  episode: Episode; user: User; operations: PendingOperations; updateEpisode: (value: Episode) => void;
}) {
  const mounted = useRef(true);
  const [error, setError] = useState("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, [episode.id]);
  async function reload() {
    try { const result = await api<Episode>(`/episodes/${episode.id}`); if (mounted.current) updateEpisode(result); }
    catch (exception) { if (mounted.current && !isSessionInterruption(exception)) setError((exception as Error).message); }
  }
  const common = { operations, method: "POST" as const, transform: payload, conflictNoun: "reevaluación", reasonLabel: "Motivo de la reevaluación",
    onDirty: () => {}, onConflict: () => { void reload(); },
    onApplied: (path: string, result: unknown, body?: BodyInit | null) => {
      notifyOperationalConfirmation(path, body);
      if (mounted.current) { updateEpisode(result as Episode); setError(""); }
    } };
  const active = episode.status === "ACTIVE";
  const items = episode.reevaluations ?? [];
  return <section className="panel reevaluations-panel" aria-label="Reevaluaciones programadas">
    <h2>Reevaluaciones programadas</h2>
    <p>El médico indica el momento y la acción de cada disciplina. Leer el aviso no completa el pendiente.</p>
    {active && <ReevaluationSummary actions={items} />}
    {error && <p role="alert">{error}</p>}
    {user.role === "DOCTOR" && <details><summary>Programar reevaluación</summary>
      <OperationalWriteForm {...common} path={`/episodes/${episode.id}/reevaluations`} version={episode.clinical_version} blocked={!active} label="Confirmar programación de reevaluación">
        <label>Nombre del seguimiento<input name="title" required minLength={3} maxLength={300} /></label>
        <label>Acción de medicina<textarea name="medical_instruction" minLength={3} maxLength={300} /></label>
        <label>Acción de enfermería<textarea name="nursing_instruction" minLength={3} maxLength={300} /></label>
        <p>Completa una acción o ambas. Si son ambas, se crean dos pendientes vinculados que se resuelven por separado.</p>
        <ReevaluationSchedule />
      </OperationalWriteForm>
    </details>}
    {items.length === 0 && <p>No hay reevaluaciones programadas.</p>}
    {items.map(item => {
      const pending = item.status === "PENDING";
      const sameRole = user.role === (item.service === "MEDICAL" ? "DOCTOR" : "NURSE");
      const owns = sameRole && user.username === item.owner_username;
      return <article key={item.id} className="task" aria-label={`Reevaluación ${item.id}`}>
        <div><h3>{item.group_title} · {clinicalLabel("service", item.service)}</h3>
          <p>{item.title}</p><p>Programada para: {staffingAuditDate(item.due_at)} · hora dominicana</p>
          <p>Estado: {statusLabel(item.status)}. Responsable actual: {item.owner_name || item.owner_username || "Sin responsable confirmado"}.</p>
          <ReevaluationDue dueAt={item.due_at} pending={active && pending} />
          {item.result && <p>Lo realizado: {item.result}</p>}
          {!item.owner_username && pending && <p>Coordinación debe confirmar un responsable para registrar su realización.</p>}
          {sameRole && <details><summary>Registrar realización de esta acción</summary>
            {!owns && <p>Solo puede completar el responsable confirmado; acepta primero el relevo si vas a sustituirlo.</p>}
            <OperationalWriteForm {...common} path={`/reevaluations/${item.id}/complete`} version={item.version} blocked={!active || !pending || !owns} label="Confirmar reevaluación realizada">
              <label>Lo realizado<textarea name="completion_note" required minLength={3} maxLength={2000} /></label>
              <p>Los signos y evaluaciones clínicas se registran en sus secciones; esta confirmación no los crea automáticamente.</p>
            </OperationalWriteForm>
          </details>}
          {user.role === "DOCTOR" && <><details><summary>Reprogramar esta acción</summary>
            <OperationalWriteForm {...common} path={`/reevaluations/${item.id}/reschedule`} version={item.version} blocked={!active || !pending} label="Confirmar reprogramación">
              <ReevaluationSchedule />
            </OperationalWriteForm>
          </details><details><summary>Cancelar esta acción</summary>
            <OperationalWriteForm {...common} path={`/reevaluations/${item.id}/cancel`} version={item.version} blocked={!active || !pending} label="Confirmar cancelación"><p>La acción queda cancelada con motivo; su historial se conserva.</p></OperationalWriteForm>
          </details></>}
        </div>
      </article>;
    })}
    {(episode.reevaluation_changes?.length ?? 0) > 0 && <details><summary>Historial de reevaluaciones</summary>
      <ol>{episode.reevaluation_changes!.map(change => <Changes key={change.id} change={change} />)}</ol>
    </details>}
  </section>;
}
