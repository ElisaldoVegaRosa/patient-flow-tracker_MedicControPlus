import type { FormEvent } from "react";
import type { LaboratoryQueue } from "../types/clinical";

type LaboratoryPageProps = {
  laboratoryQueue: LaboratoryQueue;
  onRefresh: () => Promise<void>;
  onCompleteOrder: (event: FormEvent<HTMLFormElement>, taskId: number) => Promise<void>;
};

export default function LaboratoryPage({
  laboratoryQueue,
  onRefresh,
  onCompleteOrder,
}: LaboratoryPageProps) {
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
        <strong>{laboratoryQueue.total}</strong>
        <span>Órdenes pendientes</span>
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
      <section className="lab-grid">
        {laboratoryQueue.orders.map((order) => (
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

            <form
              className="lab-result-form"
              onSubmit={(event) =>
                onCompleteOrder(event, order.id)
              }
            >
              <label>
                Resultado de laboratorio

                <textarea
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

              <button type="submit">
                Publicar resultado y completar
              </button>
            </form>
          </article>
        ))}
      </section>
    )}
  </main>
  );
}
