import type { FormEvent } from "react";
import type { LaboratoryQueue } from "../types/clinical";

type LaboratoryPageProps = {
  laboratoryQueue: LaboratoryQueue;
  canPublish?: boolean;
  isCompleting?: (taskId: number) => boolean;
  onRefresh: () => Promise<void>;
  onCompleteOrder: (event: FormEvent<HTMLFormElement>, taskId: number) => Promise<void>;
};

export default function LaboratoryPage({
  laboratoryQueue,
  onRefresh,
  onCompleteOrder,
  isCompleting = () => false,
  canPublish = true,
}: LaboratoryPageProps) {
  const active = laboratoryQueue.orders.filter(order => order.episode_status === "ACTIVE" && order.status === "PENDING");
  const closed = laboratoryQueue.orders.filter(order => order.episode_status === "CLOSED");
  return (
  <main className="container">
    <div className="page-title">
      <div>
        <span>LABORATORIO SIMULADO</span>
        <h1>Órdenes pendientes</h1>
        <p>
          Registra y publica resultados para los episodios activos.
        </p>
      </div>

      <button onClick={onRefresh}>
        Actualizar bandeja
      </button>
    </div>

    <section className="lab-summary">
      <article>
        <strong>{active.length}</strong>
        <span>Órdenes ejecutables</span>
      </article>
      <article>
        <strong>{closed.length}</strong>
        <span>Pendientes de episodios cerrados</span>
      </article>
    </section>

    {laboratoryQueue.orders.length === 0 ? (
      <section className="panel empty-state">
        <div className="empty-icon">✓</div>
        <h2>No hay órdenes pendientes</h2>
        <p>
          Las nuevas órdenes de laboratorio aparecerán aquí.
        </p>
      </section>
    ) : (
      <>
      {[{ title: "Órdenes ejecutables", orders: active }, { title: "Pendientes de episodios cerrados", orders: closed }].map(group => (
      <section key={group.title} aria-label={group.title}>
        <h2>{group.title}</h2>
        {group.orders.length === 0 && <p>No hay órdenes en este grupo.</p>}
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
                <dd>{order.status}</dd>
              </div>
            </dl>

            {order.episode_status === "CLOSED" ? <p>El episodio está cerrado. Esta orden pendiente se conserva para consulta; no se puede publicar un resultado.</p> : !canPublish ? <p>Consulta de laboratorio. Solo laboratorio puede publicar resultados.</p> : <form data-draft-kind="lab" data-episode-id={order.episode_id} data-task-id={order.id} data-draft-version={order.version}
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
