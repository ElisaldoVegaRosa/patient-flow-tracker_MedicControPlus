import { useState } from "react";
import type { FormEvent } from "react";
import { isSessionInterruption } from "../api/client";
import type { Episode, User } from "../types/clinical";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { VersionedWrites } from "../hooks/useVersionedWrites";

const identitySummary = (value: string) => {
  try {
    const data = JSON.parse(value);
    return `${data.name} · ${data.document ?? "Documento no registrado"} · ${data.birth_date ?? "Nacimiento no registrado"}`;
  } catch { return value; }
};

export function IdentityBadge({ status }: { status?: string }) {
  return status === "PROVISIONAL" ? <> <strong>Identidad provisional · por verificar</strong></> : null;
}

export default function PatientIdentity({ episode, user, operations, writes, onUpdated, onSaved }: {
  episode: Episode; user: User; operations: PendingOperations; writes: VersionedWrites;
  onUpdated: (episode: Episode) => void; onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const key = `episode:${episode.id}:identity`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (user.role !== "ADMISSION" || episode.identity_status !== "PROVISIONAL") return;
    const release = operations.start(key);
    if (!release) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setError("");
    try {
      const updated = await writes.write(`/episodes/${episode.id}/identity`, {
        method: "PATCH", body: JSON.stringify(data),
      }, episode.id, episode.identity_version);
      onSaved();
      onUpdated(updated);
    } catch (exception) {
      if (!isSessionInterruption(exception)) setError((exception as Error).message);
    } finally { release(); }
  }

  return <section className="panel" aria-label="Identidad del paciente">
    <h2>Identidad del paciente</h2>
    {episode.identity_status === "PROVISIONAL" ? <>
      <p><IdentityBadge status={episode.identity_status} />. La atención continúa sobre este episodio.</p>
      {user.role !== "ADMISSION" && <p>Admisión/archivo debe verificar los datos. No se crea otro ingreso para completar la identidad.</p>}
    </> : <p>{episode.identity_status === "VERIFIED" ? "Identidad verificada por admisión/archivo." : "Datos registrados; sin constancia de verificación por admisión/archivo."}</p>}
    {user.role === "ADMISSION" && episode.identity_status === "PROVISIONAL" && <>
      <p>Completa los datos cotejados y su fuente. Si existe otra ficha, se requiere revisión; no se fusionan registros.</p>
      <form data-draft-kind="identity" data-episode-id={episode.id} data-draft-version={episode.identity_version}
        className="form-grid" onSubmit={submit}>
        <label>Nombre verificado<input name="name" required disabled={operations.isPending(key)}
          defaultValue={episode.name.startsWith("Paciente desconocido ") ? "" : episode.name} /></label>
        <label>Nacimiento verificado<input name="birth_date" type="date" required disabled={operations.isPending(key)} defaultValue={episode.birth_date ?? ""} /></label>
        <label>Documento verificado<input name="document" required disabled={operations.isPending(key)} defaultValue={episode.document ?? ""} /></label>
        <label>Fuente de verificación<textarea name="verification_source" required minLength={3} maxLength={2000} disabled={operations.isPending(key)} /></label>
        <label>Motivo de la confirmación<textarea name="reason" required minLength={3} maxLength={2000} disabled={operations.isPending(key)} /></label>
        <button type="submit" disabled={operations.isPending(key)}>{operations.isPending(key) ? "Verificando identidad…" : "Confirmar identidad verificada"}</button>
      </form>
    </>}
    {error && <p role="alert">{error}</p>}
    {!!episode.identity_changes?.length && <details><summary>Historial de identidad</summary>
      {episode.identity_changes.map(change => <article key={change.id}>
        <p>Anterior: {identitySummary(change.old_value)}</p>
        <p>Confirmado: {identitySummary(change.new_value)}</p>
        <p>Motivo: {change.reason}</p><p>Fuente: {change.verification_source}</p>
        <p>{change.username} · {change.created_at} · EP-{change.episode_id}</p>
      </article>)}
    </details>}
  </section>;
}
