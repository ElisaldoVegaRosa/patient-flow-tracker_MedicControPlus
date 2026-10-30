import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, getSessionRevision, getWriteRevision, isSessionInterruption } from "../api/client";
import { useLiveRefresh } from "../hooks/useLiveRefresh";
import { useFollowupDoctors } from "../hooks/useFollowupDoctors";
import type { PendingOperations } from "../hooks/usePendingOperations";
import type { LaboratoryFollowup, LaboratoryFollowupQueue, SessionUser } from "../types/clinical";
import LaboratoryFollowupCard from "../components/LaboratoryFollowupCard";
import { notifyOperationalConfirmation, OPERATION_CONFIRMED_EVENT, operationalFormDirty } from "../session/operationalWrites";

type Data = { queue: LaboratoryFollowupQueue; retained: LaboratoryFollowup[] };
export default function LaboratoryFollowupsPage({ user, operations, onOpenEpisode }: {
  user: SessionUser; operations: PendingOperations; onOpenEpisode: (id: number) => void;
}) {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [mine, setMine] = useState(false), [resolved, setResolved] = useState(false), [offset, setOffset] = useState(0);
  const [dirty, setDirty] = useState(false);
  const root = useRef<HTMLElement>(null), dataRef = useRef<Data | null>(null);
  const mounted = useRef(true), serial = useRef(0);
  const recipients = useFollowupDoctors(user);
  const query = `/lab/followups?mine=${mine}&include_resolved=${resolved}&limit=20&offset=${offset}`;
  const forms = () => [...(root.current?.querySelectorAll<HTMLFormElement>("form[data-operational]") ?? [])].filter(operationalFormDirty);
  const updateDirty = () => setDirty(forms().length > 0);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new MutationObserver(() => setDirty([...node.querySelectorAll<HTMLFormElement>("form[data-operational]")].some(operationalFormDirty)));
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const apply = useCallback((value: Data) => { dataRef.current = value; setData(value); }, []);
  const load = useCallback(async (signal?: AbortSignal): Promise<Data> => {
    const queue = await api<LaboratoryFollowupQueue>(query, { signal });
    const dirtyIds = new Set([...root.current?.querySelectorAll<HTMLFormElement>("form[data-operational]") ?? []]
      .filter(operationalFormDirty).map(form => Number(form.closest("[data-followup-id]")?.getAttribute("data-followup-id"))));
    const previous = [...dataRef.current?.queue.items ?? [], ...dataRef.current?.retained ?? []];
    const removed = previous.filter(item => dirtyIds.has(item.id) && !queue.items.some(current => current.id === item.id));
    const retained = await Promise.all(removed.map(item => api<LaboratoryFollowup>(`/lab/followups/${item.id}`, { signal })));
    return { queue, retained };
  }, [query]);
  const reload = useCallback(async () => {
    const ticket = ++serial.current, session = getSessionRevision(), writes = getWriteRevision();
    try {
      const value = await load();
      if (mounted.current && ticket === serial.current && session === getSessionRevision() && writes === getWriteRevision()) { apply(value); setError(""); }
    } catch (exception) {
      if (mounted.current && ticket === serial.current && !isSessionInterruption(exception)) setError((exception as Error).message);
    }
  }, [load, apply]);
  const context = `${getSessionRevision()}:${user.username}:followups:${query}`;
  useLayoutEffect(() => { serial.current++; }, [context]);
  const live = useLiveRefresh({ context, paused: () => operations.hasPending() || forms().length > 0,
    load: async signal => { const ticket = ++serial.current; const value = await load(signal); return () => { if (ticket === serial.current) apply(value); }; } });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    const ticket = ++serial.current, session = getSessionRevision(), writes = getWriteRevision();
    void load(controller.signal).then(value => {
      if (mounted.current && ticket === serial.current && session === getSessionRevision() && writes === getWriteRevision()) { apply(value); setError(""); }
    }).catch(exception => {
      if (mounted.current && ticket === serial.current && !isSessionInterruption(exception)) setError((exception as Error).message);
    });
    return () => controller.abort();
  }, [load, apply]);
  useEffect(() => {
    const confirmed = (event: Event) => {
      const path = (event as CustomEvent<{ path: string }>).detail?.path;
      if (!path?.startsWith("/lab/followups/")) return;
      setNotice("Cambio de seguimiento confirmado. Proponer relevo conserva al responsable hasta que el receptor acepte.");
      void reload();
    };
    window.addEventListener(OPERATION_CONFIRMED_EVENT, confirmed);
    return () => window.removeEventListener(OPERATION_CONFIRMED_EVENT, confirmed);
  }, [reload]);
  return <main ref={root} className="container">
    <h1>Seguimiento de laboratorio tras el alta</h1>
    <p>Consulta resultados y revisiones pendientes, planes y relevos. Actualización cada 15 segundos mientras la pestaña esté visible.</p>
    <button type="button" disabled={operations.hasPending()} onClick={() => void reload()}>Actualizar seguimientos</button>
    {live.updated && <p>Última actualización automática: {new Date(live.updated).toLocaleTimeString("es-DO", { timeZone: "America/Santo_Domingo", hour12: true })}.</p>}
    {dirty && <p role="status">Hay campos sin guardar. La actualización automática está en pausa; consultar datos actuales conserva los campos y exige revisar los cambios.</p>}
    {(error || live.error) && <p role="alert">No se pudieron actualizar los seguimientos: {error || live.error}</p>}
    {notice && <p role="status">{notice}</p>}
    {recipients.error && <div role="alert"><p>{recipients.error}</p><button type="button" onClick={recipients.retry}>Reintentar consulta de médicos</button></div>}
    <div className="laboratory-order">
      <label className="sample-analysis-link"><input type="checkbox" checked={mine} disabled={operations.hasPending()} onChange={e => { setMine(e.target.checked); setOffset(0); }} />Mis responsabilidades y propuestas</label>
      <label className="sample-analysis-link"><input type="checkbox" checked={resolved} disabled={operations.hasPending()} onChange={e => { setResolved(e.target.checked); setOffset(0); }} />Incluir seguimientos sin pendientes clínicos</label>
    </div>
    {!data && !error && <p>Cargando seguimientos…</p>}
    {data && <>
      <p>Seguimientos que coinciden: {data.queue.total}.</p>
      {data.queue.items.length === 0 && <p>No hay seguimientos en esta página con los filtros actuales.</p>}
      {[...data.queue.items, ...data.retained].map(item => <div key={item.id}>
        {data.retained.some(value => value.id === item.id) && <p role="status">Seguimiento fuera del filtro actual; campos conservados para revisión.</p>}
        <LaboratoryFollowupCard {...{ item, user, operations, onOpenEpisode }} doctors={recipients.doctors} onDirty={updateDirty}
          onConflict={() => void reload()} onApplied={(path, _result, body) => notifyOperationalConfirmation(path, body)} />
      </div>)}
      <button type="button" disabled={operations.hasPending() || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>Página anterior</button>
      <button type="button" disabled={operations.hasPending() || offset + 20 >= data.queue.total} onClick={() => setOffset(value => value + 20)}>Página siguiente</button>
    </>}
  </main>;
}
