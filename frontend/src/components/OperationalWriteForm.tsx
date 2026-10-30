import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api, isSessionInterruption, VersionConflictError } from "../api/client";
import type { PendingOperations } from "../hooks/usePendingOperations";
import { matchesSubmittedFields } from "../session/submittedFields";
import { OPERATION_CONFIRMED_EVENT, OPERATION_CONFLICT_EVENT, operationalFields, operationalFormDirty } from "../session/operationalWrites";
const reasonInput = <label>Motivo<textarea name="reason" required minLength={3} maxLength={2000} /></label>;

function defaultPayload(fields: FormData): Record<string, unknown> {
  const data: Record<string, unknown> = Object.fromEntries(fields);
  for (const key of ["active", "can_coordinate"]) if (key in data) data[key] = data[key] === "true";
  return data;
}

export default function OperationalWriteForm({ path, version, method, transform, blocked = false, conflictNoun = "cuenta", reasonLabel = "Motivo", label, children, operations, onApplied, onConflict, onDirty, initialDraft, onDraft, structureRevision = 0 }: {
  structureRevision?: number;
  initialDraft?: { baseline: string; fields: Record<string, string> };
  onDraft?: (baseline: string, fields: Record<string, string>, dirty: boolean) => void;
  reasonLabel?: string; blocked?: boolean; conflictNoun?: string; path: string; version?: string; method?: "POST" | "PATCH"; transform?: (fields: FormData) => Record<string, unknown>; label: string; children: ReactNode; operations: PendingOperations;
  onApplied: (path: string, result: unknown, body?: BodyInit | null) => void;
  onConflict: () => void; onDirty: () => void;
}) {
  const [baseline, setBaseline] = useState<string | null>(initialDraft?.baseline ?? null);
  const [error, setError] = useState("");
  const [hasDraft, setHasDraft] = useState(Boolean(initialDraft));
  const form = useRef<HTMLFormElement>(null);
  const restoration = useRef(initialDraft);
  useEffect(() => {
    const node = form.current;
    if (!node || !restoration.current) return;
    for (const [name, value] of Object.entries(restoration.current.fields)) {
      const field = node.elements.namedItem(name);
      if (field instanceof HTMLInputElement && field.type === "checkbox") field.checked = value === field.value;
      else if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) field.value = value;
    }
    restoration.current = undefined;
    onDirty();
  }, [onDirty]);
  function persist(node: HTMLFormElement, currentVersion: string | null) {
    if (!onDraft) return;
    onDraft?.(currentVersion ?? version ?? "", Object.fromEntries([...operationalFields(node)].map(([name, value]) => [name, String(value)])), operationalFormDirty(node));
  }
  useEffect(() => {
    if (!structureRevision || !form.current) return;
    setBaseline(previous => previous ?? version ?? null);
    setHasDraft(operationalFormDirty(form.current));
    persist(form.current, baseline ?? version ?? null);
    onDirty();
    // Dynamic rows changed; ordinary field edits are handled by onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureRevision]);
  const stale = baseline !== null && baseline !== version;
  useEffect(() => {
    const node = form.current;
    const saved = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; body?: BodyInit | null }>).detail;
      if (!node || detail.path !== path || typeof detail.body !== "string") return;
      const fields = operationalFields(node);
      const values = transform ? transform(fields) : defaultPayload(fields);
      const current = new FormData();
      const submitted = JSON.parse(detail.body) as Record<string, unknown>;
      const normalize = (value: unknown) => value !== null && typeof value === "object" ? JSON.stringify(value) : value;
      for (const [name, value] of Object.entries(values)) current.set(name, String(normalize(value) ?? ""));
      if (!matchesSubmittedFields(current, Object.fromEntries(Object.entries(submitted).map(([name, value]) => [name, normalize(value)])))) return;
      node.reset(); setBaseline(null); setError(""); setHasDraft(false); onDirty();
    };
    window.addEventListener(OPERATION_CONFIRMED_EVENT, saved);
    const conflict = (event: Event) => { if ((event as CustomEvent<string>).detail === path) onConflict(); };
    window.addEventListener(OPERATION_CONFLICT_EVENT, conflict);
    return () => {
      window.removeEventListener(OPERATION_CONFIRMED_EVENT, saved);
      window.removeEventListener(OPERATION_CONFLICT_EVENT, conflict);
    };
  }, [path, transform, onDirty, onConflict]);
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
      release();
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
  return <form ref={form} data-operational="true" data-account-path={path} className="form-grid operational-form" onReset={() => onDraft?.(version ?? "", {}, false)} onSubmit={event => void submit(event)}
    onChange={event => { if (version) setBaseline(previous => previous ?? version); setHasDraft(operationalFormDirty(event.currentTarget)); persist(event.currentTarget, baseline ?? version ?? null); onDirty(); }}>
    <fieldset disabled={operations.hasPending() || blocked}>
      <legend>{label}</legend>
      {children}
      {reasonLabel === "Motivo" ? reasonInput : <label>{reasonLabel}<textarea name="reason" required minLength={3} maxLength={2000} /></label>}
      {stale && <div role="alert">
        <p>{conflictNoun === "cuenta" ? "Esta cuenta cambió." : "Estos datos cambiaron."} Tus campos se conservan. Revisa los datos actuales antes de continuar.</p>
        <button type="button" onClick={() => { setBaseline(version ?? null); setError(""); if (form.current) persist(form.current, version ?? null); }}>{conflictNoun === "cuenta" ? "He revisado esta cuenta; usar versión actual" : "He revisado los cambios; usar versión actual"}</button>
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
