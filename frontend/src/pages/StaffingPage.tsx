import { useEffect, useRef, useState } from "react";
import { api, getSessionRevision, isSessionInterruption } from "../api/client";
import OperationalWriteForm from "../components/OperationalWriteForm";
import { notifyOperationalConfirmation, OPERATION_CONFIRMED_EVENT, operationalFormDirty } from "../session/operationalWrites";
import type { PendingOperations } from "../hooks/usePendingOperations";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import type { StaffingData, StaffShift, User } from "../types/clinical";

const names: Record<string, string> = { PLANNED: "Planificado", ACTIVE: "Iniciado", CLOSED: "Cerrado", CANCELLED: "Cancelado",
  AVAILABLE: "Disponible confirmado", UNAVAILABLE: "No disponible", FINISHED: "Participación finalizada" };
function localDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santo_Domingo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)).replace(" ", "T");
}
function payload(fields: FormData) {
  const result: Record<string, unknown> = Object.fromEntries(fields);
  for (const key of ["area_id", "user_id", "shift_id", "coordinator_id"]) if (key in result) result[key] = Number(result[key]);
  if ("active" in result) result.active = result.active === "true";
  // This local demo schedules Dominican time explicitly; never use the PC's timezone.
  for (const key of ["starts_at", "ends_at"]) if (result[key]) result[key] = `${result[key]}:00-04:00`;
  return result;
}
const personLabel = (person: { display_name: string; username: string }) => `${person.display_name} (${person.username})`;
const empty = { areas: [], shifts: [], assignments: [], professionals: [], coordinators: [], changes: [], requested_by: "" };

export default function StaffingPage({ user, operations }: { user: User; operations: PendingOperations }) {
  const [data, setData] = useState<StaffingData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const path = user.can_coordinate ? "/staff/planning" : "/staff/mine";
  async function load(signal?: AbortSignal): Promise<StaffingData> {
    return user.can_coordinate ? api<StaffingData>(path, { signal }) : { ...empty, ...await api<Pick<StaffingData, "assignments" | "requested_by">>(path, { signal }) };
  }
  function updateDirty() {
    setDirty([...(root.current?.querySelectorAll<HTMLFormElement>("form[data-operational]") ?? [])].some(operationalFormDirty));
  }
  const { refresh, error: liveError } = useLiveRefresh({
    context: `${getSessionRevision()}:${user.username}:${path}`,
    paused: () => dirty || operations.hasPending(),
    load: async signal => { const result = await load(signal); return () => setData(result); },
  });
  async function reload() {
    const revision = getSessionRevision();
    try {
      const result = await load();
      if (mounted.current && revision === getSessionRevision()) { setData(result); setError(""); }
    } catch (exception) {
      if (mounted.current && revision === getSessionRevision() && !isSessionInterruption(exception)) setError((exception as Error).message);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);
  useEffect(() => {
    const confirmed = (event: Event) => {
      if (!(event as CustomEvent<{ path: string }>).detail.path.startsWith("/staff/")) return;
      setNotice("Operación de personal confirmada. Los episodios y sus responsables no se han modificado.");
      void reload();
    };
    window.addEventListener(OPERATION_CONFIRMED_EVENT, confirmed);
    return () => window.removeEventListener(OPERATION_CONFIRMED_EVENT, confirmed);
  });
  const common = { operations, transform: payload, method: "POST" as const, conflictNoun: "planificacion",
    onDirty: updateDirty, onConflict: () => void reload(),
    onApplied: (action: string, _result: unknown, body?: BodyInit | null) => notifyOperationalConfirmation(action, body) };
  const coordinatorOptions = data?.coordinators.map(person => <option key={person.id} value={person.id}>{personLabel(person)}</option>);
  const areaOptions = data?.areas.filter(area => area.active).map(area => <option key={area.id} value={area.id}>{area.name}</option>);
  function shiftFields(shift?: StaffShift) {
    return <>
      <label>Nombre del turno<input name="name" required maxLength={200} defaultValue={shift?.name} /></label>
      <label>Inicio · hora dominicana<input type="datetime-local" name="starts_at" required defaultValue={shift && localDate(shift.starts_at)} /></label>
      <label>Fin · hora dominicana<input type="datetime-local" name="ends_at" required defaultValue={shift && localDate(shift.ends_at)} /></label>
      <label>Responsable de coordinación<select name="coordinator_id" required defaultValue={shift?.coordinator_id ?? ""}>
        <option value="">Selecciona una cuenta con permiso</option>{coordinatorOptions}
      </select></label>
    </>;
  }
  return <main className="container" ref={root}>
    <h1>{user.can_coordinate ? "Personal, áreas y turnos" : "Mi turno"}</h1>
    <p>La planificación y disponibilidad no asignan pacientes ni transfieren responsabilidades clínicas.</p>
    <p>Horarios en República Dominicana (America/Santo_Domingo, UTC−04:00). Si cruza medianoche, elige la fecha siguiente para el fin.</p>
    <button type="button" disabled={operations.hasPending()} onClick={() => void reload()}>Consultar personal actual</button>
    <p>{dirty ? "Actualización automática pausada mientras editas." : "Actualización cada 15 segundos mientras la pestaña esté visible."}</p>
    {notice && <p role="status">{notice}</p>}{(error || liveError) && <p role="alert">{error || liveError}</p>}
    {!data && <p role="status">Consultando turnos…</p>}
    {user.can_coordinate && <>
      <section className="panel"><h2>Áreas</h2>
        <OperationalWriteForm {...common} path="/staff/areas" label="Crear área"><label>Nombre del área<input name="name" required maxLength={200} /></label></OperationalWriteForm>
        {data?.areas.map(area => <details key={area.id}><summary>{area.name} · {area.active ? "Activa" : "Inactiva"}</summary>
          <OperationalWriteForm {...common} method="PATCH" path={`/staff/areas/${area.id}`} version={area.version} label="Actualizar área">
            <label>Nombre del área<input name="name" required maxLength={200} defaultValue={area.name} /></label>
            <label>Estado del área<select name="active" defaultValue={String(Boolean(area.active))}><option value="true">Activa</option><option value="false">Inactiva</option></select></label>
          </OperationalWriteForm>
        </details>)}
      </section>
      <section className="panel"><h2>Planificar turno</h2>
        <OperationalWriteForm {...common} path="/staff/shifts" label="Crear turno">{shiftFields()}</OperationalWriteForm>
      </section>
      <section aria-label="Turnos planificados"><h2>Turnos</h2>{data?.shifts.map(shift => {
        const closed = shift.status === "CLOSED" || shift.status === "CANCELLED";
        const own = shift.coordinator_username === user.username;
        return <article className="panel" key={shift.id} aria-label={`Turno ${shift.name}`}>
          <h3>{shift.name} · {names[shift.status]}</h3>
          <p>{localDate(shift.starts_at).replace("T", " ")} — {localDate(shift.ends_at).replace("T", " ")}</p>
          <p>Coordinación: {shift.coordinator_name || shift.coordinator_username} ({shift.coordinator_username})</p>
          {(!shift.coordinator_active || !shift.coordinator_permission) && <p role="status">El responsable ya no tiene acceso de coordinación. Otra cuenta autorizada debe asumirlo explícitamente.</p>}
          {closed && <p>Turno finalizado o cancelado. Los campos que estabas editando quedan solo para consulta.</p>}
          <details><summary>Editar planificación</summary>
            <OperationalWriteForm {...common} method="PATCH" path={`/staff/shifts/${shift.id}`} version={shift.version} blocked={shift.status !== "PLANNED"} label="Actualizar turno">{shiftFields(shift)}</OperationalWriteForm>
          </details>
          {!own && <OperationalWriteForm {...common} path={`/staff/shifts/${shift.id}/assume`} version={shift.version} blocked={closed} label="Asumir coordinación de este turno">
            <p>Asumes personalmente la coordinación. Se conserva el responsable anterior en auditoría; no cambia la atención del paciente.</p>
          </OperationalWriteForm>}
          <OperationalWriteForm {...common} path={`/staff/shifts/${shift.id}/status`} version={shift.version} blocked={closed || !own} label="Confirmar estado del turno">
            <label>Nuevo estado del turno<select name="status" defaultValue={shift.status === "ACTIVE" ? "CLOSED" : "ACTIVE"}>
              <option value="ACTIVE">Iniciar turno</option><option value="CLOSED">Cerrar turno</option><option value="CANCELLED">Cancelar turno planificado</option>
            </select></label>
          </OperationalWriteForm>
          <OperationalWriteForm {...common} path="/staff/assignments" blocked={closed || (shift.status === "ACTIVE" && !own)} label="Planificar profesional">
            <input type="hidden" name="shift_id" value={shift.id} />
            <label>Profesional<select name="user_id" required defaultValue=""><option value="">Selecciona una cuenta personal activa</option>{data.professionals.map(person => <option key={person.id} value={person.id}>{personLabel(person)} · {person.role}</option>)}</select></label>
            <label>Área de trabajo<select name="area_id" required defaultValue=""><option value="">Selecciona un área activa</option>{areaOptions}</select></label>
          </OperationalWriteForm>
        </article>;
      })}</section>
    </>}
    <section aria-label="Disponibilidad del personal"><h2>{user.can_coordinate ? "Personal planificado" : "Mi planificación y disponibilidad"}</h2>
      {user.can_coordinate && <div className="form-grid">
        <label>Filtrar por área<select value={areaFilter} onChange={event => setAreaFilter(event.target.value)}><option value="">Todas</option>{data?.areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
        <label>Filtrar por turno<select value={shiftFilter} onChange={event => setShiftFilter(event.target.value)}><option value="">Todos</option>{data?.shifts.map(shift => <option key={shift.id} value={shift.id}>{shift.name}</option>)}</select></label>
      </div>}
      {data?.assignments.length === 0 && <p>No hay planificación registrada.</p>}
      {data?.assignments.map(assignment => {
        const shift = data.shifts.find(item => item.id === assignment.shift_id);
        const closed = assignment.shift_status === "CLOSED" || assignment.shift_status === "CANCELLED";
        const done = assignment.status === "FINISHED" || assignment.status === "CANCELLED";
        return <article className="panel" key={assignment.id} aria-label={`Planificación ${assignment.username} ${assignment.id}`}
          hidden={Boolean((areaFilter && String(assignment.area_id) !== areaFilter) || (shiftFilter && String(assignment.shift_id) !== shiftFilter))}>
          <h3>{personLabel(assignment)} · {assignment.area_name}</h3>
          <p>{assignment.shift_name} · {localDate(assignment.starts_at).replace("T", " ")} — {localDate(assignment.ends_at).replace("T", " ")}</p>
          <p>Estado registrado: {names[assignment.status]}. Disponible ahora por confirmación: {assignment.effective_available ? "Sí" : "No"}.</p>
          {!assignment.account_active && <p>Cuenta inactiva; no se considera disponible.</p>}
          {user.can_coordinate && <>
            <details><summary>Revisar área planificada</summary><OperationalWriteForm {...common} method="PATCH" path={`/staff/assignments/${assignment.id}/area`} version={assignment.version}
              blocked={assignment.status !== "PLANNED" || assignment.shift_status !== "PLANNED"} label="Cambiar área planificada">
              <label>Área de trabajo<select name="area_id" defaultValue={assignment.area_id}>{areaOptions}</select></label>
            </OperationalWriteForm></details>
            <OperationalWriteForm {...common} path={`/staff/assignments/${assignment.id}/status`} version={assignment.version} blocked={closed || done || shift?.coordinator_username !== user.username} label="Confirmar disponibilidad">
              <label>Nuevo estado de disponibilidad<select name="status" defaultValue="AVAILABLE">
                <option value="AVAILABLE">Disponible confirmado</option><option value="UNAVAILABLE">No disponible</option><option value="FINISHED">Finalizar participación</option><option value="CANCELLED">Cancelar planificación</option>
              </select></label>
            </OperationalWriteForm>
          </>}
        </article>;
      })}
    </section>
    {user.can_coordinate && <section className="panel"><details><summary>Historial de planificación</summary>{data?.changes.map(change => <article key={change.id}>
      <h3>{change.resource} #{change.target_id} · {change.action}</h3>
      <p>Motivo: {change.reason}</p><p>{change.actor} · {change.created_at}</p>
      <details><summary>Valores anteriores y nuevos</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{change.old_value}</pre><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{change.new_value}</pre></details>
    </article>)}</details></section>}
  </main>;
}
