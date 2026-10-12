import type { VersionedWrites } from "../hooks/useVersionedWrites";
import type { Episode } from "../types/clinical";

export default function WriteConflicts({ writes, onReviewed }: { writes: VersionedWrites; onReviewed?: (episode: Episode) => void }) {
  return <>{Object.values(writes.conflicts).map(conflict => {
    const latest = conflict.latest;
    const taskId = conflict.path.match(/^\/tasks\/(\d+)\/complete$/)?.[1];
    const task = latest?.tasks.find(item => item.id === Number(taskId));
    const alertId = conflict.path.match(/^\/alerts\/(\d+)$/)?.[1];
    const alert = latest?.alerts.find(item => item.id === Number(alertId));
    const actionable = latest?.status === "ACTIVE" && (!taskId || task?.status === "PENDING") && (!alertId || (alert && alert.status !== "RESOLVED"));
    return <section className="panel" role="region" aria-label="Cambios de otra sesión" key={conflict.path}>
      <h2>Datos modificados durante la edición</h2>
      <p>{conflict.message} Tus campos locales se conservan.</p>
      <button type="button" disabled={conflict.loading} onClick={() => writes.inspect(conflict)}>{conflict.loading ? "Consultando cambios…" : "Consultar cambios actuales"}</button>
      {latest && <>
        <p>Estado actual: {latest.status}. Prioridad: {latest.priority}. Ubicación: {latest.location}. Responsable: {latest.assigned_to || "Sin asignar"}.</p>
        {task && <p>Tarea: {task.title}. Estado: {task.status}. Resultado: {task.result || "Sin resultado"}.</p>}
        <details><summary>Revisar información clínica actual</summary>
          <p>{latest.vitals[0] ? `Signos recientes: temperatura ${latest.vitals[0].temperature} °C; pulso ${latest.vitals[0].heart_rate}; presión ${latest.vitals[0].systolic}/${latest.vitals[0].diastolic}; SpO₂ ${latest.vitals[0].spo2}%; respiraciones ${latest.vitals[0].respiratory_rate}.` : "Sin signos registrados"}</p>
          <ul>{latest.tasks.map(item => <li key={item.id}>{item.title}: {item.status} · {item.result || "Sin resultado"}</li>)}</ul>
          <ul>{latest.alerts.map(item => <li key={item.id}>{item.reason}: {item.status} · {item.responsible || "Sin responsable"}</li>)}</ul>
          <ul>{latest.events.filter(item => item.type !== "QR_SCANNED").map(item => <li key={item.id}>{item.note || "Cambio clínico registrado"} · {item.username} · {item.created_at || item.at}</li>)}</ul>
        </details>
        {actionable ? <button type="button" onClick={() => { if (writes.accept(conflict)) onReviewed?.(latest); }}>He revisado los cambios; continuar editando</button> : <p>Este recurso ya no admite esta acción. No se enviará tu borrador.</p>}
      </>}
    </section>;
  })}</>;
}
