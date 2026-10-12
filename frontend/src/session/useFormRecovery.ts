import { useCallback, useEffect, useState } from "react";
import { api, ApiError, getSessionRevision, isSessionInterruption } from "../api/client";
import type { Episode, LaboratoryQueue, SessionUser } from "../types/clinical";
import { allowsDraft, FormDraftRecovery } from "./formDrafts";
import type { DraftKind, FormDraft } from "./formDrafts";

type Status = "idle" | "waiting" | "checking" | "offer" | "retry";
export function useFormRecovery() {
  const [store] = useState(() => new FormDraftRecovery());
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [noteOnly, setNoteOnly] = useState(true);
  const clear = useCallback(() => { store.clear(); setStatus("idle"); setError(""); }, [store]);
  const suspend = useCallback((resolveVersion?: (draft: FormDraft) => string | undefined) => { store.suspend(resolveVersion); setStatus(store.remainingMs() ? "waiting" : "idle"); setError(""); }, [store]);
  useEffect(() => () => store.clear(), [store]);
  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(clear, store.remainingMs());
    return () => window.clearTimeout(timer);
  }, [store, status, clear]);

  const check = useCallback(async (user: SessionUser, restore = false) => {
    const pending = store.forUser(user);
    if (!pending) { clear(); return null; }
    setNoteOnly(pending.drafts.every(draft => draft.kind === "discharge"));
    setStatus("checking"); setError("");
    const revision = getSessionRevision();
    const current = () => revision === getSessionRevision() && store.version === pending.version && !!store.forUser(user);
    try {
      const episodes = new Map<number, Episode>();
      const valid: FormDraft[] = [];
      let laboratoryQueue: LaboratoryQueue | null = null;
      for (const draft of pending.drafts) {
        if (!allowsDraft(user.role, draft.kind)) continue;
        if (draft.episodeId !== undefined) {
          let episode = episodes.get(draft.episodeId);
          if (!episode) {
            try { episode = await api<Episode>(`/episodes/${draft.episodeId}`); }
            catch (exception) { if (exception instanceof ApiError && exception.status === 404) continue; throw exception; }
            if (!current()) return null;
            episodes.set(draft.episodeId, episode);
          }
          if (episode.id !== draft.episodeId || episode.status !== "ACTIVE") continue;
          if (draft.kind === "lab" && !episode.tasks?.some(task => task.id === draft.taskId && task.service === "LAB" && task.status === "PENDING")) continue;
        }
        valid.push(draft);
      }
      if (valid.some(draft => draft.kind === "lab")) {
        laboratoryQueue = await api<LaboratoryQueue>("/lab/orders?status=PENDING");
        if (!current()) return null;
        const orders = laboratoryQueue.orders;
        for (let i = valid.length - 1; i >= 0; i--) {
          const draft = valid[i];
          if (draft.kind === "lab" && !orders.some(order => order.id === draft.taskId && order.episode_id === draft.episodeId && order.status === "PENDING" && order.episode_status === "ACTIVE")) valid.splice(i, 1);
        }
      }
      if (!current()) return null;
      if (!valid.length) { clear(); return null; }
      if (!restore) { setStatus("offer"); return null; }
      clear();
      for (const draft of valid) store.track(user, draft);
      const episode = episodes.get(valid[0].episodeId ?? -1) ?? null;
      const note = valid.find(draft => draft.kind === "discharge")?.fields.note ?? "";
      return { drafts: valid, episode, note, laboratoryQueue };
    } catch (exception) {
      if (isSessionInterruption(exception) || !current()) return null;
      if (exception instanceof ApiError && [403, 404].includes(exception.status)) clear();
      else { setStatus("retry"); setError("No fue posible comprobar el episodio. Puedes reintentar recuperar la nota o los formularios."); }
      return null;
    }
  }, [store, clear]);
  const trackForm = useCallback((user: SessionUser, draft: FormDraft, dirty = true) => store.track(user, draft, dirty), [store]);
  const track = useCallback((username: string, episodeId: number, note: string, baseVersion?: string) => store.track({ username, role: "DOCTOR" }, { kind: "discharge", episodeId, baseVersion, fields: { note } }, !!note.trim()), [store]);
  const remove = useCallback((kind: DraftKind, episodeId?: number, taskId?: number) => store.remove(kind, episodeId, taskId), [store]);
  return { status, error, noteOnly, clear, suspend, check, track, trackForm, remove };
}
