import { staffingLocalDate } from "./staffingAuditDate";

/** Native uncontrolled fields retain reset, dirty tracking and conflict handling. */
export default function StaffDateTimeInput({ name, label, value, required = true }: { name: string; label: string; value?: string; required?: boolean }) {
  const local = value ? staffingLocalDate(value) : "";
  const hour = local ? Number(local.slice(11, 13)) : undefined;
  return <fieldset className="staff-date-time"><legend>{label}</legend>
    <label>Fecha<input type="date" name={`${name}_date`} required={required} defaultValue={local.slice(0, 10)} /></label>
    <label>Hora (1–12)<select name={`${name}_hour`} required={required} defaultValue={hour === undefined ? "" : String(hour % 12 || 12)}>
      <option value="">Hora</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
    </select></label>
    <label>Minutos<select name={`${name}_minute`} required={required} defaultValue={local ? local.slice(14, 16) : "00"}>
      {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map(minute => <option key={minute} value={minute}>{minute}</option>)}
    </select></label>
    <label>AM/PM<select name={`${name}_period`} required={required} defaultValue={hour === undefined ? "" : hour >= 12 ? "PM" : "AM"}>
      <option value="">Elige AM o PM</option><option value="AM">AM · mañana / madrugada</option><option value="PM">PM · tarde / noche</option>
    </select></label>
    <p>12:00 AM es medianoche; 12:00 PM es mediodía.</p>
  </fieldset>;
}
