import { useCallback, useEffect, useRef, useState } from "react";
import { api, getSessionRevision, isSessionInterruption, SessionInterruptedError, VersionConflictError } from "../api/client";
import type { Episode } from "../types/clinical";

export function resourceVersion(path: string, episode: Episode): string | undefined {
  if (path.endsWith("/identity")) return episode.identity_version;
  if (path.endsWith("/triage")) return episode.triage_version;
  if (/^\/episodes\/\d+\/(discharge|reopen|annul)$/.test(path)) return episode.clinical_version;
  const task = path.match(/^\/tasks\/(\d+)\/(complete|result)$/);
  if (task) return episode.tasks.find(item => item.id === Number(task[1]))?.version;
  const event = path.match(/^\/events\/(\d+)\/note$/);
  if (event) return episode.events.find(item => item.id === Number(event[1]))?.version;
  const alert = path.match(/^\/alerts\/(\d+)$/);
  if (alert) return episode.alerts.find(item => item.id === Number(alert[1]))?.version;
}

type Conflict = { path: string; episodeId: number; message: string; loading?: boolean; latest?: Episode };
export function useVersionedWrites() {
  const baselines = useRef(new Map<string, string>());
  const blocked = useRef(new Set<string>());
  const [conflicts, setConflicts] = useState<Record<string, Conflict>>({});
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; baselines.current.clear(); }, []);
  const clear = useCallback(() => { baselines.current.clear(); blocked.current.clear(); generation.current++; setConflicts({}); }, []);
  const remember = useCallback((path: string, version?: string) => {
    if (version !== undefined && !baselines.current.has(path)) baselines.current.set(path, version);
    return baselines.current.get(path) ?? version;
  }, []);
  const forget = useCallback((path: string) => {
    baselines.current.delete(path);
    blocked.current.delete(path);
    setConflicts(previous => { if (!previous[path]) return previous; const next = { ...previous }; delete next[path]; return next; });
  }, []);
  const reportConflict = useCallback((path: string, episodeId: number, error: VersionConflictError) => {
    blocked.current.add(path);
    setConflicts(previous => ({ ...previous, [path]: { path, episodeId, message: error.message } }));
  }, []);
  const write = useCallback(async (path: string, options: RequestInit, episodeId: number, version?: string) => {
    if (blocked.current.has(path)) throw new VersionConflictError("Consulta y revisa los cambios antes de volver a guardar.", 409);
    const expected = remember(path, version);
    const headers = new Headers(options.headers);
    const ticket = generation.current;
    if (expected !== undefined) headers.set("If-Match", expected);
    try {
      const updated = await api<Episode>(path, { ...options, headers });
      if (ticket !== generation.current) throw new SessionInterruptedError();
      forget(path);
      return updated;
    } catch (error) {
      if (ticket !== generation.current) throw new SessionInterruptedError();
      if (error instanceof VersionConflictError) {
        reportConflict(path, episodeId, error);
      }
      throw error;
    }
  }, [remember, forget, reportConflict]);
  const inspect = useCallback(async (conflict: Conflict) => {
    const revision = getSessionRevision();
    const ticket = generation.current;
    setConflicts(previous => ({ ...previous, [conflict.path]: { ...conflict, loading: true } }));
    try {
      const latest = await api<Episode>(`/episodes/${conflict.episodeId}`);
      if (revision !== getSessionRevision() || ticket !== generation.current) return;
      setConflicts(previous => previous[conflict.path] ? { ...previous, [conflict.path]: { ...conflict, latest, loading: false } } : previous);
    } catch (error) {
      if (isSessionInterruption(error) || ticket !== generation.current) return;
      setConflicts(previous => previous[conflict.path] ? { ...previous, [conflict.path]: { ...conflict, loading: false, message: (error as Error).message } } : previous);
    }
  }, []);
  const accept = useCallback((conflict: Conflict) => {
    const identity = conflict.path.endsWith("/identity");
    if (!conflict.latest || (!identity && conflict.latest.status === "ANNULLED")) return false;
    if (identity && conflict.latest.identity_status !== "PROVISIONAL") return false;
    const isHistorical = identity || /\/result$|\/note$|\/reopen$/.test(conflict.path);
    if (conflict.latest.status !== "ACTIVE" && !isHistorical) return false;
    if (conflict.path.endsWith("/reopen") && conflict.latest.status !== "CLOSED") return false;
    if (conflict.path.endsWith("/annul") && conflict.latest.status !== "ACTIVE") return false;
    if (conflict.path.endsWith("/annul") &&
      (conflict.latest.vitals.length > 0 || conflict.latest.tasks.length > 0 || conflict.latest.alerts.length > 0 ||
       conflict.latest.events.some(item => !["EPISODE_CREATED", "QR_SCANNED", "IDENTITY_VERIFIED"].includes(item.type)))) return false;
    const task = conflict.path.match(/^\/tasks\/(\d+)\/complete$/);
    if (task && !conflict.latest.tasks.some(item => item.id === Number(task[1]) && item.status === "PENDING")) return false;
    const result = conflict.path.match(/^\/tasks\/(\d+)\/result$/);
    if (result && !conflict.latest.tasks.some(item => item.id === Number(result[1]) && item.service === "LAB" && item.status === "COMPLETED")) return false;
    const event = conflict.path.match(/^\/events\/(\d+)\/note$/);
    if (event && !conflict.latest.events.some(item => item.id === Number(event[1]) && ["MEDICAL_EVALUATION", "DISCHARGE"].includes(item.type) && !item.annulled)) return false;
    const alert = conflict.path.match(/^\/alerts\/(\d+)$/);
    if (alert && !conflict.latest.alerts.some(item => item.id === Number(alert[1]) && item.status !== "RESOLVED")) return false;
    const version = resourceVersion(conflict.path, conflict.latest);
    if (!version) return false;
    baselines.current.set(conflict.path, version);
    blocked.current.delete(conflict.path);
    setConflicts(previous => { const next = { ...previous }; delete next[conflict.path]; return next; });
    return true;
  }, []);
  return { remember, forget, write, clear, conflicts, inspect, accept, reportConflict };
}
export type VersionedWrites = ReturnType<typeof useVersionedWrites>;
