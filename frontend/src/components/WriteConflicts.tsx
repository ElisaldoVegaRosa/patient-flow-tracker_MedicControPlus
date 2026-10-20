import type { VersionedWrites } from "../hooks/useVersionedWrites";
import type { Episode } from "../types/clinical";
import { clinicalLabel } from "../presentation/clinicalLabels";

export default function WriteConflicts({ writes, onReviewed }: { writes: VersionedWrites; onReviewed?: (episode: Episode) => void }) {
  return <>{Object.values(writes.conflicts).map(conflict => {
    const latest = conflict.latest;
    const taskId = conflict.path.match(/^\/tasks\/(\d+)\/(complete|result)$/)?.[1];
    const task = latest?.tasks.find(item => item.id === Number(taskId));
    const alertId = conflict.path.match(/^\/alerts\/(\d+)$/)?.[1];
    const alert = latest?.alerts.find(item => item.id === Number(alertId));
    const eventId = conflict.path.match(/^\/events\/(\d+)\/note$/)?.[1];
    const event = latest?.events.find(item => item.id === Number(eventId));
    const historical = /\/result$|\/note$|\/reopen$/.test(conflict.path);
    const actionable = conflict.path.endsWith("/identity") ? latest?.identity_status === "PROVISIONAL" : latest?.status !== "ANNULLED" && (latest?.status === "ACTIVE" || historical)
      && (!conflict.path.endsWith("/reopen") || latest?.status === "CLOSED")
      && (!taskId || task?.status === (conflict.path.endsWith("/result") ? "COMPLETED" : "PENDING"))
      && (!alertId || (alert && alert.status !== "RESOLVED"))
      && (!eventId || (event && !event.annulled && ["MEDICAL_EVALUATION", "DISCHARGE"].includes(event.type)))
      && (!conflict.path.endsWith("/annul") || (latest?.vitals.length === 0 && latest.tasks.length === 0 && latest.alerts.length === 0 && latest.events.every(item => ["EPISODE_CREATED", "QR_SCANNED", "IDENTITY_VERIFIED"].includes(item.type))));
    return <section className="panel" role="region" aria-label="Cambios de otra sesión" key={conflict.path}>
      <h2>Datos modificados durante la edición</h2>
      <p>{conflict.message} Tus campos locales se conservan.</p>
      <button type="button" disabled={conflict.loading} onClick={() => writes.inspect(conflict)}>{conflict.loading ? "Consultando cambios…" : "Consultar cambios actuales"}</button>
      {latest && <>
        {conflict.path.endsWith("/identity") && <p>Identidad vigente: {latest.name} · {latest.document ?? "Documento no registrado"} · {latest.birth_date ?? "Nacimiento no registrado"}. {latest.identity_status === "VERIFIED" ? "Verificada" : "Por verificar"}.</p>}
        <p>Estado actual: {clinicalLabel("episodeStatus", latest.status)}. Prioridad: {latest.priority}. Ubicación: {latest.location}. Responsable: {latest.assigned_to || "Sin asignar"}.</p>
        {task && <p>Tarea: {task.title}. Estado: {clinicalLabel("taskStatus", task.status)}. Resultado: {task.result || "Sin resultado"}.</p>}
        <details><summary>Revisar información clínica actual</summary>
          <p>{latest.vitals[0] ? `Signos recientes: temperatura ${latest.vitals[0].temperature} °C; pulso ${latest.vitals[0].heart_rate}; presión ${latest.vitals[0].systolic}/${latest.vitals[0].diastolic}; SpO₂ ${latest.vitals[0].spo2}%; respiraciones ${latest.vitals[0].respiratory_rate}.` : "Sin signos registrados"}</p>
          <ul>{latest.tasks.map(item => <li key={item.id}>{item.title}: {clinicalLabel("taskStatus", item.status)} · {item.result || "Sin resultado"}</li>)}</ul>
          <ul>{latest.alerts.map(item => <li key={item.id}>{item.reason}: {clinicalLabel("alertStatus", item.status)} · {item.responsible || "Sin responsable"}</li>)}</ul>
          <ul>{latest.events.filter(item => item.type !== "QR_SCANNED").map(item => <li key={item.id}>{item.note || "Cambio clínico registrado"} · {item.username} · {item.created_at || item.at}</li>)}</ul>
        </details>
        {actionable ? <button type="button" onClick={() => { if (writes.accept(conflict)) onReviewed?.(latest); }}>He revisado los cambios; continuar editando</button> : <p>Este recurso ya no admite esta acción. No se enviará tu borrador.</p>}
      </>}
    </section>;
  })}</>;
}
