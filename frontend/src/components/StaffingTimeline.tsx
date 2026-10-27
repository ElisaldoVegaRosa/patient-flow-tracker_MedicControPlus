import type { StaffChange } from "../types/clinical";
import { staffingActions } from "../presentation/staffingLabels";
import StaffingAuditValues from "./StaffingAuditValues";
import { staffingAuditDate } from "./staffingAuditDate";

function context(change: StaffChange) {
  try {
    const value = JSON.parse(change.new_value) ?? JSON.parse(change.old_value);
    if (!value || typeof value !== "object") return "Registro de planificación";
    const text = (key: string) => typeof value[key] === "string" ? value[key] : "";
    if (change.resource === "assignment") return [text("display_name") || text("username"), text("shift_name"), text("area_name")].filter(Boolean).join(" · ");
    return text("name") || "Registro de planificación";
  } catch { return "Registro de planificación"; }
}
function title(change: StaffChange) {
  if (change.action === "CREATE") return change.resource === "shift" ? "Turno creado" : "Área creada";
  if (change.action === "UPDATE") return change.resource === "shift" ? "Planificación del turno actualizada" : "Área actualizada";
  if (change.action === "CANCELLED") return change.resource === "shift" ? "Turno cancelado" : "Participación en el turno cancelada";
  return staffingActions[change.action] ?? "Cambio de planificación registrado";
}
export default function StaffingTimeline({ changes }: { changes: StaffChange[] }) {
  return changes.length ? <ol className="staff-timeline" aria-label="Eventos de planificación">
    {changes.map(change => <li key={change.id}><article>
      <h3>{title(change)}</h3><p><strong>{context(change)}</strong></p>
      <p><time dateTime={change.created_at}>{staffingAuditDate(change.created_at)}</time> · {change.actor} · hora dominicana</p>
      <p>Motivo: {change.reason}</p>
      <StaffingAuditValues before={change.old_value} after={change.new_value} />
    </article></li>)}
  </ol> : <p>No hay cambios de planificación en este período.</p>;
}
