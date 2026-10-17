import { useRef, useState } from "react";

type Props = {
  label: string;
  onAction: (action: "CORRECT" | "ANNUL", reason: string, value?: string) => Promise<boolean>;
  disabled?: boolean;
};

export default function RecordCorrectionForm({ label, onAction, disabled = false }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(action: "CORRECT" | "ANNUL") {
    if (!form.current || disabled || saving) return;
    const fields = new FormData(form.current);
    const reason = String(fields.get("reason") ?? "").trim();
    const value = String(fields.get("value") ?? "").trim();
    if (reason.length < 3 || (action === "CORRECT" && value.length < 3)) {
      setError("Escribe un motivo y, para corregir, el texto nuevo (mínimo 3 caracteres).");
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (await onAction(action, reason, action === "CORRECT" ? value : undefined)) form.current?.reset();
    } finally {
      setSaving(false);
    }
  }
  return <form ref={form} data-record-correction onSubmit={event => event.preventDefault()} className="medical-form">
    <label>{label}<textarea name="value" rows={3} maxLength={2000} disabled={disabled || saving} /></label>
    <label>Motivo de la acción<input name="reason" maxLength={500} disabled={disabled || saving} /></label>
    {error && <p role="alert">{error}</p>}
    <button type="button" disabled={disabled || saving} onClick={() => void submit("CORRECT")}>Registrar corrección</button>
    <button type="button" disabled={disabled || saving} onClick={() => void submit("ANNUL")}>Anular vigencia</button>
  </form>;
}
