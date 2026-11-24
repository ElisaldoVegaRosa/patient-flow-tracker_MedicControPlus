import { useEffect, useRef, useState } from "react";
import { api, isSessionInterruption } from "../api/client";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { Episode, SessionUser } from "../types/clinical";
import { readSpecimenDraft, saveSpecimenDraft } from "../session/specimenDrafts";
import { notifyOperationalConfirmation } from "../session/operationalWrites";
import OperationalWriteForm from "./OperationalWriteForm";

export default function ConsultationReasonEditor(props: {
  episode: Episode; user: SessionUser; operations: PendingOperations; onUpdated: (episode: Episode) => void;
}) {
  if (!["RECEPTION", "SUPERVISOR"].includes(props.user.role) || props.episode.status !== "ACTIVE") return null;
  return <Editor key={`${props.user.username}:${props.episode.id}`} {...props} />;
}

function Editor({ episode, user, operations, onUpdated }: Parameters<typeof ConsultationReasonEditor>[0]) {
  const path = `/episodes/${episode.id}/consultation-reason`;
  const [saved] = useState(() => readSpecimenDraft(user, path));
  const [warning, setWarning] = useState(saved.warning.replace("de laboratorio", "del motivo de consulta"));
  const [confirmed, setConfirmed] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function refresh() {
    try {
      const latest = await api<Episode>(`/episodes/${episode.id}`);
      if (mounted.current) onUpdated(latest);
    } catch (error) {
      if (mounted.current && !isSessionInterruption(error)) setWarning("No se pudieron consultar los cambios actuales. Actualiza el episodio antes de continuar.");
    }
  }
  return <details><summary>Corregir motivo de consulta</summary>
    <p>Se conservarán el texto anterior, la justificación y el autor de cada corrección. El registro original del ingreso no se sustituye.</p>
    {!episode.consultation_reason_version && <p>Actualiza el episodio para consultar su versión vigente.</p>}
    {warning && <p role="alert">{warning}</p>}
    {confirmed && <p role="status">Corrección del motivo de consulta guardada.</p>}
    <OperationalWriteForm path={path} method="PATCH" version={episode.consultation_reason_version}
      blocked={!episode.consultation_reason_version} conflictNoun="motivo de consulta"
      label="Guardar corrección del motivo de consulta" reasonLabel="Justificación de la corrección"
      operations={operations} initialDraft={saved.draft} onDirty={() => {}}
      onDraft={(baseline, fields, dirty) => {
        setWarning(saveSpecimenDraft(user, path, baseline, fields, dirty));
        if (dirty) setConfirmed(false);
      }} onConflict={() => { void refresh(); }}
      onApplied={(confirmedPath, result, body) => {
        if (!mounted.current) return;
        notifyOperationalConfirmation(confirmedPath, body);
        setConfirmed(true);
        onUpdated(result as Episode);
      }}>
      <label>Motivo de consulta corregido<textarea name="value" rows={3} required minLength={3} maxLength={1000}
        defaultValue={episode.consultation_reason ?? ""} /></label>
    </OperationalWriteForm>
  </details>;
}
