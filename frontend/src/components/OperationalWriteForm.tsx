import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api, isSessionInterruption, VersionConflictError } from "../api/client";
import type { PendingOperations } from "../hooks/usePendingOperations";
import { matchesSubmittedFields } from "../session/submittedFields";
import { OPERATION_CONFIRMED_EVENT, operationalFields, operationalFormDirty } from "../session/operationalWrites";
const reasonInput = <label>Motivo<textarea name="reason" required minLength={3} maxLength={2000} /></label>;

function defaultPayload(fields: FormData): Record<string, unknown> {
  const data: Record<string, unknown> = Object.fromEntries(fields);
  for (const key of ["active", "can_coordinate"]) if (key in data) data[key] = data[key] === "true";
  return data;
}

export default function OperationalWriteForm({ path, version, method, transform, blocked = false, conflictNoun = "cuenta", label, children, operations, onApplied, onConflict, onDirty }: {
  blocked?: boolean; conflictNoun?: string; path: string; version?: string; method?: "POST" | "PATCH"; transform?: (fields: FormData) => Record<string, unknown>; label: string; children: ReactNode; operations: PendingOperations;
  onApplied: (path: string, result: unknown, body?: BodyInit | null) => void;
  onConflict: () => void; onDirty: () => void;
}) {
  const [baseline, setBaseline] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const stale = baseline !== null && baseline !== version;
  useEffect(() => {
    const node = form.current;
    const saved = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; body?: BodyInit | null }>).detail;
      if (!node || detail.path !== path || typeof detail.body !== "string") return;
      const fields = operationalFields(node);
      const values = transform ? transform(fields) : defaultPayload(fields);
      const current = new FormData();
      for (const [name, value] of Object.entries(values)) current.set(name, String(value ?? ""));
      if (!matchesSubmittedFields(current, JSON.parse(detail.body))) return;
      node.reset(); setBaseline(null); setError(""); setHasDraft(false); onDirty();
    };
    window.addEventListener(OPERATION_CONFIRMED_EVENT, saved);
    return () => window.removeEventListener(OPERATION_CONFIRMED_EVENT, saved);
  }, [path, transform, onDirty]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stale || blocked) return;
    const release = operations.start(path);
    if (!release) return;
    const fields = new FormData(event.currentTarget);
    const data = transform ? transform(fields) : defaultPayload(fields);
    const body = JSON.stringify(data);
    setError("");
    try {
      const result = await api<unknown>(path, { method: method ?? (path.endsWith("/status") || path.endsWith("/coordination") ? "PATCH" : "POST"), body,
        headers: version ? { "If-Match": baseline ?? version } : undefined });
      onApplied(path, result, body);
    } catch (exception) {
      if (!isSessionInterruption(exception)) {
        setError((exception as Error).message);
        if (exception instanceof VersionConflictError) {
          setBaseline(baseline ?? version ?? null);
          onConflict();
        }
      }
    } finally { release(); }
  }
  function discardDraft() {
    form.current?.reset();
    setBaseline(null);
    setError("");
    setHasDraft(false);
    onDirty();
  }
  return <form ref={form} data-operational="true" data-account-path={path} className="form-grid" onSubmit={event => void submit(event)}
    onChange={event => { if (version) setBaseline(previous => previous ?? version); setHasDraft(operationalFormDirty(event.currentTarget)); onDirty(); }}>
    <fieldset disabled={operations.hasPending() || blocked}>
      <legend>{label}</legend>
      {children}
      {reasonInput}
      {stale && <div role="alert">
        <p>{conflictNoun === "cuenta" ? "Esta cuenta cambió." : "Estos datos cambiaron."} Tus campos se conservan. Revisa los datos actuales antes de continuar.</p>
        <button type="button" onClick={() => { setBaseline(version ?? null); setError(""); }}>{conflictNoun === "cuenta" ? "He revisado esta cuenta; usar versión actual" : "He revisado los cambios; usar versión actual"}</button>
      </div>}
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={stale}>{operations.isPending(path) ? "Guardando…" : label}</button>
    </fieldset>
    {hasDraft && <div className="operational-draft" role="status">
      <p>{blocked ? "Esta acción ya no está disponible. Hay campos anteriores sin guardar en este formulario." : "Hay campos sin guardar en este formulario."}</p>
      <button type="button" disabled={operations.hasPending()} onClick={discardDraft}>Descartar campos de {label}</button>
    </div>}
  </form>;
}
