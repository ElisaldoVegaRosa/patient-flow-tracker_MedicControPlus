import { useRef, useState } from "react";
import type { FormEvent } from "react";

export default function ReasonActionForm({ label, onAction, disabled = false }: {
  label: string; onAction: (reason: string) => Promise<boolean>; disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = input.current?.value.trim() ?? "";
    if (reason.length < 3) { setError("Explica el motivo (mínimo 3 caracteres)."); return; }
    setError(""); setSaving(true);
    try { if (await onAction(reason) && input.current) input.current.value = ""; }
    finally { setSaving(false); }
  }
  return <form data-record-correction onSubmit={submit} className="medical-form">
    <label>Motivo<input ref={input} name="reason" maxLength={500} disabled={disabled || saving} /></label>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={disabled || saving}>{saving ? "Guardando…" : label}</button>
  </form>;
}
