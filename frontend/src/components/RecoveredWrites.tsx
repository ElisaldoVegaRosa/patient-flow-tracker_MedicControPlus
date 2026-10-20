import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { bindWriteRecovery, getDamagedWriteReferences, inspectDamagedWriteReference, confirmRecoveredWrite, forgetRecoveredWrite, getRecoveredWrites, getSessionRevision, getWriteRecoveryError, inspectRecoveredWrite, isSessionInterruption, refreshWriteRecovery, reviewRecoveredWrite, WRITE_RESULTS_EVENT } from "../api/client";
import { WRITE_REFERENCE_PREFIX } from "../session/writeReferences";
import type { WriteKind, WriteReference } from "../session/writeReferences";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { SessionUser } from "../types/clinical";

const labels: Record<WriteKind, string> = { identity: "Identidad", arrival: "Ingreso", triage: "Triaje", vitals: "Signos vitales", evaluation: "Evaluación", order: "Orden", task: "Resultado de tarea", alert: "Cambio de alerta", discharge: "Alta", demo: "Datos de demostración", rules: "Reglas", operation: "Operación" };
const operationKey = (key: string) => `recovered-write:${key}`;

export default function RecoveredWrites({ user, operations, onConfirmed }: {
  user: SessionUser;
  operations: PendingOperations;
  onConfirmed: () => void;
}) {
  const [pending, setPending] = useState(getRecoveredWrites);
  const [error, setError] = useState(getWriteRecoveryError);
  const [damaged, setDamaged] = useState(getDamagedWriteReferences);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const checked = useRef(new Set<string>());
  const mounted = useRef(true);
  const callbacks = useRef({ operations, onConfirmed });
  useLayoutEffect(() => { callbacks.current = { operations, onConfirmed }; });
  useEffect(() => {
    mounted.current = true;
    const update = () => { setPending(getRecoveredWrites()); setError(getWriteRecoveryError()); setDamaged(getDamagedWriteReferences()); };
    const storage = (event: StorageEvent) => { if (event.key === null || event.key.startsWith(WRITE_REFERENCE_PREFIX)) refreshWriteRecovery(); };
    window.addEventListener(WRITE_RESULTS_EVENT, update);
    window.addEventListener("storage", storage);
    return () => { mounted.current = false; window.removeEventListener(WRITE_RESULTS_EVENT, update); window.removeEventListener("storage", storage); };
  }, []);

  const inspect = useRef<(item: WriteReference) => Promise<void>>(async () => {});
  useLayoutEffect(() => {
    inspect.current = async item => {
      const release = callbacks.current.operations.start(operationKey(item.key));
      if (!release) return;
      const revision = getSessionRevision();
      try {
        const response = await inspectRecoveredWrite(item.key);
        if (!mounted.current || revision !== getSessionRevision()) return;
        if (response.status === "confirmed") {
          confirmRecoveredWrite(item.key);
          // The original body is lost: never clear or attribute a current form to this receipt.
          callbacks.current.onConfirmed();
        } else setMessages(previous => ({ ...previous, [item.key]: "Sin confirmación. El envío puede seguir en curso; esto no demuestra que haya fallado." }));
      } catch (exception) {
        if (mounted.current && revision === getSessionRevision() && !isSessionInterruption(exception)) setMessages(previous => ({ ...previous, [item.key]: "No se pudo consultar el resultado. La referencia se conserva; puedes volver a consultar." }));
      } finally { release(); }
    };
  });
  useEffect(() => {
    let cancelled = false;
    // Consult once per reference and session, sequentially. Failed/unknown reads never retry writes.
    void Promise.resolve().then(async () => {
      for (const item of pending) {
        if (cancelled || !mounted.current) return;
        if (checked.current.has(item.key)) continue;
        checked.current.add(item.key);
        await inspect.current(item);
      }
    });
    return () => { cancelled = true; };
  }, [pending]);

  function manual(item: WriteReference, remove: boolean) {
    try { if (remove) forgetRecoveredWrite(item.key); else reviewRecoveredWrite(item.key); }
    catch (exception) {
      if (!isSessionInterruption(exception)) setMessages(previous => ({ ...previous, [item.key]: "No se pudo guardar la revisión local. La referencia se conserva." }));
    }
  }
  async function inspectDamage(key: string) {
    const release = callbacks.current.operations.start(`damaged-write:${key}`);
    if (!release) return;
    const revision = getSessionRevision();
    try {
      const result = await inspectDamagedWriteReference(key);
      if (!mounted.current || revision !== getSessionRevision()) return;
      if (result.status === "confirmed") callbacks.current.onConfirmed();
      else setMessages(previous => ({ ...previous, [key]: "Sin confirmación. La referencia se conserva y las nuevas operaciones siguen bloqueadas." }));
    } catch (exception) {
      if (mounted.current && revision === getSessionRevision() && !isSessionInterruption(exception)) setMessages(previous => ({ ...previous, [key]: "No se pudo confirmar la referencia. Puede haber cambiado durante la consulta; se conserva. Vuelve a consultar." }));
    } finally { release(); }
  }
  if (!error && !pending.length) return null;
  return <>
    {error && <section className="panel" aria-label="Registro de envíos no disponible">
      <p role="alert">{error}</p>
      <p>Las consultas siguen disponibles. Las nuevas operaciones están bloqueadas para evitar perder su referencia.</p>
      <button type="button" onClick={() => { void bindWriteRecovery(user).catch(() => {}); }}>Reintentar cargar referencias</button>
      {damaged.map((item, index) => <article key={item.key}>
        <h3>Referencia dañada · {index + 1}</h3>
        {item.consultable ? <>
          <p>Se conservan su identificador y propietario. Consultar no vuelve a enviar; solo una confirmación del servidor permite retirar esta referencia dañada.</p>
          <button type="button" disabled={operations.isPending(`damaged-write:${item.key}`)} onClick={() => void inspectDamage(item.key)}>Consultar referencia dañada</button>
        </> : <p>No se pueden verificar su identificador o propietario. Se conserva sin consultar ni eliminar. Solicita revisión del almacenamiento local; no borres los datos del navegador para desbloquear envíos.</p>}
        {messages[item.key] && <p role="status">{messages[item.key]}</p>}
      </article>)}
    </section>}
    {pending.length > 0 && <section className="panel" aria-label="Envíos recuperados por revisar">
    <h2>Envíos anteriores por revisar</h2>
    <p>Se conservó su identificador tras recargar o cambiar de sesión. Consultar no vuelve a enviar. El contenido original ya no está disponible para reintentarlo.</p>
    {pending.some(item => !item.reviewed) && <p>Revisa estos envíos antes de crear otra operación. Puedes consultar los registros del sistema.</p>}
    {pending.map(item => <article key={item.key}>
      <h3>{labels[item.kind]} · {new Date(item.createdAt).toLocaleString()}</h3>
      <p role="status">{messages[item.key] ?? "Consultando el resultado anterior…"}</p>
      {item.reviewed && <p>Revisión manual registrada. El resultado sigue sin confirmar; esta revisión no demuestra que el envío haya fallado.</p>}
      <button type="button" disabled={operations.isPending(operationKey(item.key))} onClick={() => void inspect.current(item)}>Consultar resultado anterior</button>
      {!item.reviewed ? <>
        <p>Marca la revisión solo después de comprobar los registros. Habilitar nuevos envíos puede duplicar una operación si la anterior termina más tarde. {error && "La revisión de este envío no elimina el bloqueo por referencias dañadas."}</p>
        <button type="button" disabled={operations.isPending(operationKey(item.key))} onClick={() => manual(item, false)}>{error ? "He revisado los registros de este envío" : "He revisado los registros; habilitar nuevos envíos"}</button>
      </> : <button type="button" disabled={operations.isPending(operationKey(item.key))} onClick={() => manual(item, true)}>Retirar aviso revisado</button>}
    </article>)}
  </section>}
  </>;
}
