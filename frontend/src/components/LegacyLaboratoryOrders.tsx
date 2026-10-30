import type { Episode } from "../types/clinical";
import { clinicalLabel } from "../presentation/clinicalLabels";

export default function LegacyLaboratoryOrders({ episode }: { episode: Episode }) {
  const identifiers = episode.laboratory?.legacy_order_ids;
  if (!identifiers?.length) return null;
  const orders = episode.tasks.filter(task => task.service === "LAB" && identifiers.includes(task.id));
  const pending = orders.filter(task => !["COMPLETED", "ANNULLED"].includes(task.status));
  return <section className="panel" aria-label="Órdenes anteriores de laboratorio">
    <details><summary>Órdenes anteriores de laboratorio ({orders.length})</summary>
      <p>Estas órdenes conservan un resultado único. No tienen desglose de muestras. Las revisiones al alta se consultan en la línea de tiempo del episodio.</p>
      <p>Pendientes de resolver: {pending.length}.</p>
      {orders.map(order => <article key={order.id}>
        <h3>{order.title} · Orden #{order.id}</h3>
        <p>Estado: {clinicalLabel("taskStatus", order.status)}</p>
        {order.status === "COMPLETED" && <p>Resultado vigente: {order.result || "Sin texto registrado"}</p>}
        {order.status === "ANNULLED" && <p>Resultado sin vigencia. Las correcciones y anulaciones se conservan en el historial del episodio.</p>}
        {!["COMPLETED", "ANNULLED"].includes(order.status) && <p>Consulta la bandeja de laboratorio para resolver esta orden.</p>}
      </article>)}
    </details>
  </section>;
}
