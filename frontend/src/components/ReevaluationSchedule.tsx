import { useEffect, useRef, useState } from "react";
import StaffDateTimeInput from "./StaffDateTimeInput";
import { staffingAuditDate, staffingDatePayload } from "./staffingAuditDate";

/** The preview is a fixed instant, so retries and receipts preserve the same intention. */
export default function ReevaluationSchedule() {
  const root = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState("AT");
  const [preview, setPreview] = useState("");
  useEffect(() => {
    const form = root.current?.closest("form");
    const reset = () => { setMode("AT"); setPreview(""); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  function changed() {
    const form = root.current?.closest("form");
    if (!form) return;
    const fields = new FormData(form);
    const selected = String(fields.get("schedule_mode"));
    setMode(selected);
    let value = "";
    if (selected === "AFTER") {
      const minutes = Number(fields.get("within_minutes"));
      if (Number.isSafeInteger(minutes) && minutes > 0 && minutes <= 1_000_000) value = new Date(Date.now() + minutes * 60_000).toISOString();
    } else value = String(staffingDatePayload(fields).due_at ?? "");
    const input = form.elements.namedItem("due_at") as HTMLInputElement;
    input.value = value;
    setPreview(value);
  }
  return <div ref={root} onChange={changed}>
    <label>Cuándo reevaluar<select name="schedule_mode" defaultValue="AT"><option value="AT">Fecha y hora exactas</option><option value="AFTER">Dentro de una cantidad de minutos</option></select></label>
    <div hidden={mode !== "AT"}><StaffDateTimeInput name="due_at" label="Fecha y hora de reevaluación · hora dominicana" required={mode === "AT"} /></div>
    <label hidden={mode !== "AFTER"}>Dentro de cuántos minutos<input name="within_minutes" type="number" min={1} max={1_000_000} step={1} required={mode === "AFTER"} /></label>
    <input type="text" hidden readOnly name="due_at" defaultValue="" />
    <p role={preview ? "status" : undefined}>{preview ? <>Fecha y hora que se guardarán: <strong>{staffingAuditDate(preview, true)}</strong> · hora dominicana.</> : "Completa la fecha y hora o el número de minutos para revisar el momento programado."}</p>
    {mode === "AFTER" && <p>El momento mostrado se mantiene fijo mientras completas el formulario. Cambia los minutos si necesitas recalcularlo.</p>}
  </div>;
}
