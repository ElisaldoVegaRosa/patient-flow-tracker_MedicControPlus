import type { FormEvent } from "react";
import type { LaboratoryQueue } from "../types/clinical";
import RecordCorrectionForm from "../components/RecordCorrectionForm";
import { clinicalLabel } from "../presentation/clinicalLabels";

type LaboratoryPageProps = {
  laboratoryQueue: LaboratoryQueue;
  canPublish?: boolean;
  isCompleting?: (taskId: number) => boolean;
  onRefresh: () => Promise<void>;
  onCompleteOrder: (event: FormEvent<HTMLFormElement>, taskId: number) => Promise<void>;
  onFilterChange?: (status: "PENDING" | "COMPLETED" | "ALL") => Promise<void>;
  onChangeResult?: (taskId: number, action: "CORRECT" | "ANNUL", reason: string, value?: string) => Promise<boolean>;
};

export default function LaboratoryPage({
  laboratoryQueue,
  onRefresh,
  onCompleteOrder,
  onFilterChange,
  onChangeResult,
  isCompleting = () => false,
  canPublish = true,
}: LaboratoryPageProps) {
  const active = laboratoryQueue.orders.filter(order => order.episode_status === "ACTIVE" && order.status === "PENDING");
  const closed = laboratoryQueue.orders.filter(order => order.episode_status === "CLOSED" && order.status === "PENDING");
  const completed = laboratoryQueue.orders.filter(order => order.status === "COMPLETED" || order.status === "ANNULLED");
  return (
  <main className="container">
    <div className="page-title">
      <div>
        <span>LABORATORIO SIMULADO</span>
        <h1>Órdenes de laboratorio</h1>
        <p>
          Registra y publica resultados para los episodios activos.
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
      {[
        ...(laboratoryQueue.status_filter !== "COMPLETED" ? [
          { title: "Órdenes ejecutables", orders: active },
          { title: "Pendientes de episodios cerrados", orders: closed },
        ] : []),
        ...(laboratoryQueue.status_filter !== "PENDING" ? [
          { title: "Completadas y anuladas", orders: completed },
        ] : []),
      ].filter(group => group.orders.length > 0).map(group => (
      <section key={group.title} aria-label={group.title}>
        <h2>{group.title}</h2>
        <div className="lab-grid">
        {group.orders.map((order) => (
          <article className="panel lab-order" key={order.id}>
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
                <dd>{order.patient_name}</dd>
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
                <dd>{clinicalLabel("taskStatus", order.status)}</dd>
              </div>
            </dl>

            {order.status !== "PENDING" ? <>
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
