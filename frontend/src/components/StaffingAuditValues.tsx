import { staffingAuditDate } from "./staffingAuditDate";
const labels: Record<string, string> = {
  name: "Nombre", starts_at: "Inicio del turno", ends_at: "Fin del turno",
  status: "Estado", active: "Activo", coordinator_id: "Cuenta de coordinación",
  coordinator_name: "Coordinación", coordinator_username: "Usuario de coordinación",
  coordinator_active: "Cuenta de coordinación activa", coordinator_permission: "Permiso de coordinación",
  shift_id: "Número de turno", shift_name: "Turno", user_id: "Cuenta del profesional",
  username: "Usuario", display_name: "Profesional", role: "Rol", account_active: "Cuenta activa",
  area_id: "Número de área", area_name: "Área", area_active: "Área activa",
  shift_status: "Estado del turno", effective_available: "Disponible por confirmación",
};
const states: Record<string, string> = {
  PLANNED: "Planificado", ACTIVE: "Iniciado", CLOSED: "Cerrado", CANCELLED: "Cancelado",
  AVAILABLE: "Disponible confirmado", UNAVAILABLE: "No disponible", FINISHED: "Participación finalizada",
  DOCTOR: "Médico", NURSE: "Enfermería", LAB: "Laboratorio",
};
function parse(value: string): Record<string, unknown> | null {
  const parsed: unknown = JSON.parse(value);
  if (parsed === null) return null;
  if (typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid snapshot");
  return parsed as Record<string, unknown>;
}
function display(key: string, value: unknown) {
  if (value === undefined || value === null) return "Sin registro";
  if (["active", "account_active", "area_active", "coordinator_active", "coordinator_permission", "effective_available"].includes(key)) {
    if (value === true || value === 1) return "Sí";
    if (value === false || value === 0) return "No";
  }
  if ((key === "starts_at" || key === "ends_at") && typeof value === "string") return staffingAuditDate(value);
  return ["status", "shift_status", "role"].includes(key) ? states[String(value)] ?? String(value) : String(value);
}
export default function StaffingAuditValues({ before, after }: { before: string; after: string }) {
  let rows: string[] = [];
  let old: Record<string, unknown> | null = null;
  let next: Record<string, unknown> | null = null;
  let invalid = false;
  try {
    old = parse(before); next = parse(after);
    rows = Object.keys(labels).filter(key => JSON.stringify(old?.[key]) !== JSON.stringify(next?.[key]));
  } catch { invalid = true; }
  return <>
    <p>Fechas en hora dominicana (UTC−04:00).</p>
    {invalid ? <p>No se pudo mostrar el resumen de este cambio. Solicita una revisión a soporte.</p>
      : rows.length ? <div style={{ overflowX: "auto" }}><table>
        <caption>Cambios registrados</caption>
        <thead><tr><th scope="col">Campo</th><th scope="col">Antes</th><th scope="col">Después</th></tr></thead>
        <tbody>{rows.map(key => <tr key={key}><th scope="row">{labels[key]}</th><td>{display(key, old?.[key])}</td><td>{display(key, next?.[key])}</td></tr>)}</tbody>
      </table></div> : <p>Sin cambios en los campos resumidos.</p>}
  </>;
}
