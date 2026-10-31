import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { acknowledgeInterruptedWrites, confirmWrite, getSessionRevision, getUncertainWrites, getWriteBody, inspectWrite, isSessionInterruption, needsInterruptedWriteReview, retryWrite, WRITE_RESULTS_EVENT } from "../api/client";
import type { UncertainWrite } from "../api/client";
import type { PendingOperations } from "../hooks/usePendingOperations";
import { clinicalLabel } from "../presentation/clinicalLabels";

function operationKey(path: string) {
  const resource = path.match(/^\/(tasks|alerts)\/(\d+)/);
  if (resource) return `${resource[1] === "tasks" ? "task" : "alert"}:${resource[2]}`;
  const episode = path.match(/^\/episodes\/(\d+)\/(.+)$/);
  if (episode) return `episode:${episode[1]}:${({ "medical-evaluation": "evaluation", tasks: "order" } as Record<string, string>)[episode[2]] ?? episode[2]}`;
  return ({ "/episodes": "arrival", "/demo/seed": "demo", "/rules/evaluate": "rules" } as Record<string, string>)[path] ?? path;
}

function label(path: string) {
  const contact = path.match(/^\/communications\/(\d+)\/(authorize|attempt|explain|rectify)$/);
  if (contact) return `Contacto del seguimiento #${contact[1]} · ${{ authorize: "Autorizar aviso", attempt: "Gestión de contacto", explain: "Explicación clínica", rectify: "Rectificación" }[contact[2]]}`;
  const followup = path.match(/^\/lab\/followups\/(\d+)\/(plan|propose|accept|cancel-handoff)$/);
  if (followup) return `Seguimiento #${followup[1]} · ${{ plan: "Plan", propose: "Proponer relevo", accept: "Aceptar relevo", "cancel-handoff": "Cancelar o rechazar relevo" }[followup[2]]}`;
  const order = path.match(/^\/episodes\/(\d+)\/lab-orders$/);
  if (order) return `EP-${order[1]} · Crear orden de laboratorio`;
  const sample = path.match(/^\/lab\/specimens\/(\d+)\/(collection|delivery|receipt|suitability|repeat)$/);
  const lifecycle = path.match(/^\/lab\/analyses\/(\d+)\/(cancel|reinstate)$/);
  if (lifecycle) return `Analítica #${lifecycle[1]} · ${lifecycle[2] === "cancel" ? "Cancelación" : "Reactivación"}`;
  const publication = path.match(/^\/lab\/analyses\/(\d+)\/results$/);
  if (publication) return `Analítica #${publication[1]} · Publicar resultado`;
  const result = path.match(/^\/lab\/results\/(\d+)\/(corrections|annul|review)$/);
  if (result) return `Resultado #${result[1]} · ${{ corrections: "Corrección", annul: "Anulación", review: "Revisión médica" }[result[2]]}`;
  if (sample) return `Muestra #${sample[1]} · ${clinicalLabel("specimenAction", sample[2])}`;
  if (path.startsWith("/care/")) return `Responsables y relevo · EP-${path.split("/")[3]}`;
  if (path.startsWith("/staff/")) return "Planificación de personal";
  if (path === "/accounts") return "Crear cuenta";
  if (path.startsWith("/accounts/")) return `Cuenta #${path.split("/")[2]} · ${path.endsWith("/password") ? "Restablecer contraseña" : "Estado"}`;
  if (path.endsWith("/identity")) return `Identidad · EP-${path.split("/")[2]}`;
  if (path === "/episodes") return "Ingreso";
  if (path.startsWith("/tasks/")) return `Resultado de tarea ${path.split("/")[2]}`;
  if (path.startsWith("/alerts/")) return `Cambio de alerta ${path.split("/")[2]}`;
  const name = ({ triage: "Triaje", discharge: "Alta", vitals: "Signos vitales", "medical-evaluation": "Evaluación", tasks: "Orden", seed: "Datos de demostración", evaluate: "Reglas" } as Record<string, string>)[path.split("/").at(-1)!] ?? "Operación";
  return path.startsWith("/episodes/") ? `${name} · EP-${path.split("/")[2]}` : name;
}

export default function UncertainWrites({ operations, onConfirmed, onRejected }: {
  operations: PendingOperations;
  onConfirmed: (path: string, result: unknown, body: BodyInit | null | undefined) => void;
  onRejected?: (path: string, error: Error) => void;
}) {
  const [pending, setPending] = useState(getUncertainWrites);
  const [reviewRequired, setReviewRequired] = useState(needsInterruptedWriteReview);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const mounted = useRef(true);
  const handlers = useRef({ onConfirmed, onRejected });
  useLayoutEffect(() => { handlers.current = { onConfirmed, onRejected }; }, [onConfirmed, onRejected]);
  useEffect(() => {
    mounted.current = true;
    const update = () => { setPending(getUncertainWrites()); setReviewRequired(needsInterruptedWriteReview()); setMessages({}); };
    window.addEventListener(WRITE_RESULTS_EVENT, update);
    return () => { mounted.current = false; window.removeEventListener(WRITE_RESULTS_EVENT, update); };
  }, []);
  async function resolve(item: UncertainWrite, retry: boolean) {
    const release = operations.start(operationKey(item.path));
    if (!release) return;
    const revision = getSessionRevision();
    const body = getWriteBody(item.key);
    try {
      const response = retry ? { status: "confirmed", result: await retryWrite(item.key) } : await inspectWrite(item.key);
      if (!mounted.current || revision !== getSessionRevision()) return;
      if (response.status === "confirmed") {
        confirmWrite(item.key);
        release();
        handlers.current.onConfirmed(item.path, response.result, body);
      } else {
        setMessages(previous => ({ ...previous, [item.key]: "Todavía no hay confirmación. Esto no demuestra que el envío haya fallado; puede seguir en curso." }));
      }
    } catch (error) {
      if (!mounted.current || revision !== getSessionRevision() || isSessionInterruption(error)) return;
      if (!getUncertainWrites().some(pending => pending.key === item.key)) handlers.current.onRejected?.(item.path, error as Error);
      setMessages(previous => ({ ...previous, [item.key]: (error as Error).message }));
    } finally {
      release();
    }
  }
  if (reviewRequired) return <section className="panel" aria-label="Revisión tras cambiar de sesión">
    <p>La sesión anterior tenía un envío por confirmar. Su clave ya no está disponible. Consulta los registros antes de realizar otra operación.</p>
    <p>Las consultas siguen disponibles. Esta revisión no vuelve a enviar ni garantiza recuperar la intención anterior.</p>
    <button type="button" onClick={acknowledgeInterruptedWrites}>He revisado los registros; continuar</button>
  </section>;
  if (!pending.length) return null;
  return <section className="panel" aria-label="Guardados por confirmar">
    <h2>Guardados por confirmar</h2>
    <p>Consultar no vuelve a enviar. Reintentar envía la operación original, aunque hayas editado los campos después.</p>
    {pending.map(item => <div key={item.key}>
      <h3>{label(item.path)}</h3>
      <p role="status">{messages[item.key] ?? item.message}</p>
      <button type="button" disabled={operations.isPending(operationKey(item.path))} onClick={() => void resolve(item, false)}>Consultar resultado</button>
      <button type="button" disabled={operations.isPending(operationKey(item.path))} onClick={() => void resolve(item, true)}>Reintentar operación original</button>
    </div>)}
  </section>;
}
