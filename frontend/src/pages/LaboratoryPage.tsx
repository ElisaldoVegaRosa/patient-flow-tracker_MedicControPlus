import { IdentityBadge } from "../components/PatientIdentity";
import type { FormEvent } from "react";
import type { LaboratoryQueue } from "../types/clinical";
import SpecimenWorkPanel from "../components/SpecimenWorkPanel";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { SessionUser } from "../types/clinical";
import type { SampleApplied } from "../components/SpecimenWorkPanel";
import StructuredLaboratoryOrder from "../components/StructuredLaboratoryOrder";
import RecordCorrectionForm from "../components/RecordCorrectionForm";
import { clinicalLabel } from "../presentation/clinicalLabels";
import PatientSearch from "../components/PatientSearch";
import { usePatientSearch } from "../hooks/usePatientSearch";

type LaboratoryPageProps = {
  onConflict?: () => void;
  user?: SessionUser; operations?: PendingOperations; onSampleApplied?: SampleApplied;
  laboratoryQueue: LaboratoryQueue;
  canPublish?: boolean;
  isCompleting?: (taskId: number) => boolean;
  onRefresh: () => Promise<void>;
  onCompleteOrder: (event: FormEvent<HTMLFormElement>, taskId: number) => Promise<void>;
  onFilterChange?: (status: "PENDING" | "COMPLETED" | "ALL") => Promise<void>;
  onChangeResult?: (taskId: number, action: "CORRECT" | "ANNUL", reason: string, value?: string) => Promise<boolean>;
};

export default function LaboratoryPage({
  laboratoryQueue, user, operations, onSampleApplied, onConflict,
  onRefresh,
  onCompleteOrder,
  onFilterChange,
  onChangeResult,
  isCompleting = () => false,
  canPublish = true,
}: LaboratoryPageProps) {
  const search = usePatientSearch();
  const matchesOrder = (order: LaboratoryQueue["orders"][number]) => search.matches(order.patient_name, order.episode_id);
  const matchingOrders = laboratoryQueue.orders.filter(matchesOrder);
  const isStructured = (order: LaboratoryQueue["orders"][number]) => order.workflow === "STRUCTURED" || Boolean(order.laboratory);
  const actualStatus = (order: LaboratoryQueue["orders"][number]) => isStructured(order) ? order.laboratory?.status ?? "PENDING" : order.status;
  const isTerminal = (order: LaboratoryQueue["orders"][number]) => ["COMPLETED", "COMPLETED_WITH_CANCELLATIONS", "CANCELLED", "ANNULLED"].includes(actualStatus(order));
  const active = laboratoryQueue.orders.filter(order => order.episode_status === "ACTIVE" && !isTerminal(order));
  const closed = laboratoryQueue.orders.filter(order => order.episode_status === "CLOSED" && !isTerminal(order));
  const completed = laboratoryQueue.orders.filter(isTerminal);
  return (
  <main className="container">
    <div className="page-title">
      <div>
        <span>LABORATORIO SIMULADO</span>
        <h1>Órdenes de laboratorio</h1>
        <p>
          Consulta las órdenes, sus muestras y los resultados disponibles.
        </p>
      </div>

      <button onClick={onRefresh}>
        Actualizar bandeja
      </button>
    </div>

    <label>Mostrar órdenes
      <select aria-label="Mostrar órdenes" value={laboratoryQueue.status_filter} onChange={event => {
        const next = event.target.value as "PENDING" | "COMPLETED" | "ALL";
        void onFilterChange?.(next);
      }}>
        <option value="PENDING">Pendientes</option>
        <option value="COMPLETED">Completadas</option>
        <option value="ALL">Todas</option>
      </select>
    </label>
    <PatientSearch query={search.query} onChange={search.setQuery} count={matchingOrders.length} total={laboratoryQueue.orders.length} unit="órdenes" />

    {laboratoryQueue.status_filter !== "COMPLETED" && <section className="lab-summary">
      <article>
        <strong>{active.length}</strong>
        <span>Órdenes ejecutables</span>
      </article>
      <article>
        <strong>{closed.length}</strong>
        <span>Pendientes de episodios cerrados</span>
      </article>
    </section>}

    {laboratoryQueue.orders.length === 0 ? (
      <section className="panel empty-state">
        <div className="empty-icon">✓</div>
        <h2>No hay órdenes en este filtro</h2>
        <p>
          Las nuevas órdenes de laboratorio aparecerán aquí.
        </p>
      </section>
    ) : (
      <>
      {matchingOrders.length === 0 && <p>No hay coincidencias con la búsqueda y el filtro actual.</p>}
      {[
        ...(laboratoryQueue.status_filter !== "COMPLETED" ? [
          { title: "Órdenes ejecutables", orders: active },
          { title: "Pendientes de episodios cerrados", orders: closed },
        ] : []),
        ...(laboratoryQueue.status_filter !== "PENDING" ? [
          { title: "Completadas y anuladas", orders: completed },
        ] : []),
      ].filter(group => group.orders.length > 0).map(group => (
      // Keep forms mounted so searching cannot discard unsaved results or corrections.
      <section className="lab-results-group" key={group.title} aria-label={group.title} hidden={!group.orders.some(matchesOrder)}>
        <h2>{group.title}</h2>
        <div className="lab-grid">
        {group.orders.map((order) => (
          <article className="panel lab-order" key={order.id} hidden={!matchesOrder(order)}>
            <div className="lab-order-header">
              <div>
                <span className="order-number">
                  ORDEN #{order.id}
                </span>

                <h2>{order.title}</h2>
              </div>

              <span className={`priority p${order.priority}`}>
                P{order.priority}
              </span>
            </div>

            <dl className="lab-details">
              <div>
                <dt>Paciente</dt>
                <dd>{order.patient_name}<IdentityBadge status={order.patient_identity_status} /></dd>
              </div>

              <div>
                <dt>Episodio</dt>
                <dd>EP-{order.episode_id}</dd>
              </div>

              <div>
                <dt>Ubicación</dt>
                <dd>{order.location}</dd>
              </div>

              <div>
                <dt>Estado</dt>
                <dd>{clinicalLabel(isStructured(order) ? "laboratoryStatus" : "taskStatus", actualStatus(order))}</dd>
              </div>
            </dl>

            {isStructured(order) ? order.laboratory ? <>
              <StructuredLaboratoryOrder laboratory={order.laboratory} user={user} operations={operations} onApplied={onSampleApplied}
                onConflict={onConflict ?? (() => { void onRefresh(); })} blocked={!["PENDING", "COMPLETED"].includes(order.status)} />
              {user && operations && onSampleApplied && <SpecimenWorkPanel specimens={order.laboratory.specimens} analyses={order.laboratory.analyses} user={user} operations={operations}
                blocked={order.laboratory.processing_context === "UNAVAILABLE" || order.status !== "PENDING"} onApplied={onSampleApplied} onConflict={onConflict ?? (() => { void onRefresh(); })} />}
            </> :
              <p role="alert">No se pudo consultar el detalle de esta orden. Actualiza la bandeja antes de continuar.</p> : order.status !== "PENDING" ? <>
              <p>Resultado vigente: {order.status === "ANNULLED" ? "Anulado" : order.result || "Sin resultado"}</p>
              {(order.record_changes ?? []).length > 0 && <details><summary>Ver correcciones y resultados anteriores</summary>
                {(order.record_changes ?? []).map(change => <article key={change.id}>
                  <p>{clinicalLabel("changeAction", change.action)} · Motivo: {change.reason}</p>
                  <p>Anterior: {change.old_value ?? "Sin texto"}</p>
                  <p>Nuevo: {change.new_value ?? "Sin texto vigente"}</p>
                  <small>{change.username} · {new Date(change.created_at).toLocaleString()}</small>
                </article>)}
              </details>}
              {canPublish && order.status === "COMPLETED" && onChangeResult && <RecordCorrectionForm label="Resultado corregido" onAction={(action, reason, value) => onChangeResult(order.id, action, reason, value)} />}
            </> : order.episode_status === "CLOSED" ? <p>El episodio está cerrado. Esta orden pendiente se conserva para consulta; no se puede publicar un resultado.</p> : !canPublish ? <p>Consulta de laboratorio. Solo laboratorio puede publicar resultados.</p> : <form data-draft-kind="lab" data-episode-id={order.episode_id} data-task-id={order.id} data-draft-version={order.version}
              className="lab-result-form"
              onSubmit={(event) =>
                onCompleteOrder(event, order.id)
              }
            >
              <label>
                Resultado de laboratorio

                <textarea
                  disabled={isCompleting(order.id)}
                  name="result"
                  rows={4}
                  placeholder={
                    "Ejemplo: hemoglobina 13.8 g/dL; " +
                    "leucocitos 8,400/mm3"
                  }
                  minLength={3}
                  required
                />
              </label>

              <button type="submit" disabled={isCompleting(order.id)}>
                {isCompleting(order.id) ? "Publicando resultado…" : "Publicar resultado y completar"}
              </button>
            </form>}
          </article>
        ))}
        </div>
      </section>))}
      </>
    )}
  </main>
  );
}
